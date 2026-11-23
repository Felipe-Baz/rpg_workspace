// Monta, de forma pura, os documentos de um lote criado por uma extensão (sem tocar no Firestore).
// Tudo recebe a marca `origem` para o mestre poder listar e desfazer o lote inteiro.
import type { Acao } from "./acoes.ts";

export type Origem = { extensao: string; lote: string };
export type ItemLote = { tipo: "ficha" | "missao"; id: string; nome: string };

export type FichaLote = {
  id: string; donoUid: string; categoria: string; nome: string; foto: ""; texto: string; criadoEm: number;
  mestre: true; todos: boolean; liberadoPara: string[]; origem: Origem;
};

export type MissaoLote = {
  id: string; titulo: string; descricaoPublica: string; descricaoMestre: ""; status: "em_andamento"; dificuldade: string; categoria: string;
  etapas: { id: string; texto: string; status: "atual" | "pendente"; notaMestre: ""; dataConclusao: "" }[]; criadoEm: number; origem: Origem;
};

export type JogadorLote = { id: string; nome: string; personagem: string; uid?: string };

export type DocumentosLote = {
  fichas: FichaLote[];
  missoes: MissaoLote[];
  itens: ItemLote[];
  avisos: string[];
};

/**
 * `jogadores`: os da mesa (para converter ids em contas). Quem ainda não reivindicou o personagem (sem `uid`)
 * não consegue ver a ficha: vira aviso. `novoId` e `agora` são injetados para o teste ser determinístico.
 */
export function montarDocumentosLote(entrada: {
  acoes: readonly Acao[];
  uidMestre: string;
  jogadores: readonly JogadorLote[];
  origem: Origem;
  agora: number;
  novoId: () => string;
}): DocumentosLote {
  const { acoes, uidMestre, jogadores, origem, agora, novoId } = entrada;
  const saida: DocumentosLote = { fichas: [], missoes: [], itens: [], avisos: [] };

  for (const a of acoes) {
    if (a.tipo === "ficha") {
      const { categoria, nome, texto, liberarPara } = a.dados;
      let liberadoPara: string[] = [];
      if (Array.isArray(liberarPara)) {
        for (const id of liberarPara) {
          const j = jogadores.find((x) => x.id === id);
          if (!j) saida.avisos.push(`“${nome}”: jogador “${id}” não existe nesta mesa; não foi liberada para ele.`);
          else if (!j.uid) saida.avisos.push(`“${nome}”: ${j.personagem || j.nome || id} ainda não entrou na mesa com uma conta; a ficha não foi liberada para esse personagem.`);
          else liberadoPara.push(j.uid);
        }
        liberadoPara = [...new Set(liberadoPara)];
      }
      const ficha: FichaLote = { id: novoId(), donoUid: uidMestre, categoria, nome, foto: "", texto, criadoEm: agora, mestre: true, todos: liberarPara === "todos", liberadoPara, origem };
      saida.fichas.push(ficha);
      saida.itens.push({ tipo: "ficha", id: ficha.id, nome });
    } else {
      const { titulo, descricao, categoria, dificuldade, etapas } = a.dados;
      const missao: MissaoLote = {
        id: novoId(), titulo, descricaoPublica: descricao, descricaoMestre: "", status: "em_andamento", dificuldade, categoria,
        // A primeira etapa fica visível; as demais ficam ocultas até o mestre avançar.
        etapas: etapas.map((texto, i) => ({ id: novoId(), texto, status: i === 0 ? ("atual" as const) : ("pendente" as const), notaMestre: "" as const, dataConclusao: "" as const })),
        criadoEm: agora, origem,
      };
      saida.missoes.push(missao);
      saida.itens.push({ tipo: "missao", id: missao.id, nome: titulo });
    }
  }
  return saida;
}
