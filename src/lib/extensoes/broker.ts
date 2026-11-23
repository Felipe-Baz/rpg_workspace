"use client";

// Broker: o app atende, com as credenciais de QUEM ESTÁ USANDO, os pedidos que a extensão faz via window.RPG.
// A extensão nunca recebe credenciais nem fala com o Firebase: ela só pergunta, e o app confere a permissão aprovada
// pelo mestre, lê o que aquele usuário já pode ler (as regras do Firestore continuam sendo a barreira final)
// e devolve uma versão reduzida dos dados.

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { MUNDO_PADRAO } from "@/content/valgreth";
import { db } from "../firebase";
import { lerMundoJson } from "../mundo";
import type { Mesa } from "../mesas";
import { atender, leitorExemplo, type Leitor } from "./broker-puro";
import type { Pedido, Permissao } from "./capacidades";

export type FonteDados = "real" | "exemplo";

type Cru = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const lista = (v: unknown): Cru[] => (Array.isArray(v) ? (v as Cru[]) : []);

async function docs(caminho: [string, ...string[]], ...filtros: ReturnType<typeof where>[]): Promise<Cru[]> {
  const col = collection(db, ...(caminho as [string, string, ...string[]]));
  const snap = await getDocs(filtros.length ? query(col, ...filtros) : col);
  return snap.docs.map((d) => d.data() as Cru);
}

function leitorReal(mesa: Mesa, papel: "mestre" | "jogador", uid: string): Leitor {
  const mestre = papel === "mestre";
  return async (alvo, args) => {
    switch (alvo) {
      case "mesa":
        return { nome: mesa.nome, sistema: mesa.sistema, status: mesa.status, descricao: mesa.descricao, totalJogadores: mesa.jogadores.length, totalSessoes: mesa.sessoes.length };

      case "jogadores":
        return { total: mesa.jogadores.length, itens: mesa.jogadores.map((j) => ({ id: j.id, jogador: j.nome, personagem: j.personagem })) };

      case "sessoes": {
        const itens = [...mesa.sessoes].sort((a, b) => b.data.localeCompare(a.data)).map((s) => ({ id: s.id, titulo: s.titulo, data: s.data, resumo: s.resumoPublico }));
        return { total: itens.length, itens };
      }

      case "missoes": {
        const publicas = await docs(["mesas", mesa.id, "missoes"]);
        // Mestre: visão completa (dificuldade e etapas ocultas); missões antigas só existem na pública.
        const completas = mestre ? await docs(["mesas", mesa.id, "missoesMestre"]) : [];
        const ids = new Set(completas.map((m) => str(m.id)));
        const base = [...completas, ...publicas.filter((p) => !ids.has(str(p.id)))];
        const itens = base.map((m) => ({
          id: str(m.id),
          titulo: str(m.titulo),
          descricao: str(m.descricaoPublica) || str(m.descricao),
          status: str(m.status),
          categoria: str(m.categoria),
          ...(mestre && m.dificuldade ? { dificuldade: str(m.dificuldade) } : {}),
          etapas: lista(m.etapas).map((e) => ({ texto: str(e.texto), status: str(e.status) })),
        }));
        return { total: itens.length, itens };
      }

      case "fichas": {
        const grupos = mestre
          ? [await docs(["mesas", mesa.id, "fichas"], where("mestre", "==", true))]
          : await Promise.all([
              docs(["mesas", mesa.id, "fichas"], where("donoUid", "==", uid)),
              docs(["mesas", mesa.id, "fichas"], where("todos", "==", true)),
              docs(["mesas", mesa.id, "fichas"], where("liberadoPara", "array-contains", uid)),
            ]);
        const unicas = new Map<string, Cru>();
        grupos.flat().forEach((f) => unicas.set(str(f.id), f));
        const itens = [...unicas.values()].map((f) => ({ id: str(f.id), categoria: str(f.categoria), nome: str(f.nome), texto: str(f.texto) }));
        return { total: itens.length, itens };
      }

      case "mundo": {
        const snap = await getDoc(doc(db, "mesas", mesa.id, "mundo", "principal"));
        const json = snap.exists() ? str(snap.data().json) : "";
        let mundo = MUNDO_PADRAO;
        if (json) {
          try { mundo = lerMundoJson(json); } catch { /* inválido: usa o padrão, como a tela do Mundo */ }
        }
        if (typeof args?.secao === "string") {
          const s = mundo.secoes.find((x) => x.id === args.secao);
          if (!s) throw new Error(`Seção não encontrada: ${args.secao}`);
          return { id: s.id, titulo: s.titulo, resumo: s.resumo ?? "", blocos: s.blocos };
        }
        return { titulo: mundo.titulo, subtitulo: mundo.subtitulo ?? "", secoes: mundo.secoes.map((s) => ({ id: s.id, titulo: s.titulo, resumo: s.resumo ?? "" })) };
      }
    }
  };
}

export type RegistroChamada = { quando: number; op: string; alvo: string; ok: boolean; detalhe: string };

/**
 * Cria o atendedor de pedidos de UMA extensão.
 * `aprovadas`: permissões que o mestre aprovou (na prévia do criador, as pedidas no manifesto).
 * `fonte`: "exemplo" usa dados fictícios (modo ensaio) em vez da mesa real.
 */
export function criarBroker(opcoes: {
  mesa: Mesa;
  papel: "mestre" | "jogador";
  uid: string;
  aprovadas: readonly Permissao[];
  fonte?: FonteDados;
  aoRegistrar?: (r: RegistroChamada) => void;
}) {
  const leitor = opcoes.fonte === "exemplo" ? leitorExemplo : leitorReal(opcoes.mesa, opcoes.papel, opcoes.uid);
  return async (pedido: Pedido): Promise<unknown> => {
    const registro = (ok: boolean, detalhe: string) => opcoes.aoRegistrar?.({ quando: Date.now(), op: pedido.op, alvo: pedido.alvo, ok, detalhe });
    try {
      const r = await atender(pedido, opcoes.aprovadas, leitor);
      const n = r && typeof r === "object" && "total" in r ? ` · ${(r as { total: number }).total} itens` : "";
      registro(true, `ok${n}`);
      return r;
    } catch (e) {
      registro(false, e instanceof Error ? e.message : "erro");
      throw e;
    }
  };
}
