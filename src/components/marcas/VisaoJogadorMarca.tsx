"use client";

import { useEffect, useRef, useState } from "react";
import { indiceDaMarca, marcaPorId, type Nivel, type Notas } from "@/lib/marcas-data";
import { salvarNotas, useMinhaAtribuicao, useMinhasNotasIniciais } from "@/lib/marcas";
import Enigmas from "./Enigmas";
import Sigilo from "./Sigilo";

export default function VisaoJogadorMarca({ mesaId, uid }: { mesaId: string; uid: string }) {
  const { pronto, markId } = useMinhaAtribuicao(mesaId, uid);
  const marca = marcaPorId(markId);

  if (!pronto) return <p className="dim">Consultando os registros…</p>;
  if (!marca)
    return (
      <div className="panel mx-auto max-w-lg p-8 text-center">
        <h2 className="text-xl">Aguarde</h2>
        <p className="dim mt-2">O Mestre ainda não lhe revelou uma Marca. Os pactos se fazem no tempo deles.</p>
      </div>
    );
  return <Diario mesaId={mesaId} uid={uid} markId={marca.id} />;
}

function Diario({ mesaId, uid, markId }: { mesaId: string; uid: string; markId: string }) {
  const marca = marcaPorId(markId)!;
  const { pronto, notas: iniciais } = useMinhasNotasIniciais(mesaId, uid);
  if (!pronto) return <p className="dim">Abrindo o diário…</p>;
  return (
    <div className="space-y-8">
      <section className="panel flex flex-col items-center gap-6 p-6 sm:flex-row">
        <Sigilo index={indiceDaMarca(marca.id)} size={140} className="shrink-0 text-[var(--m-blood-hi)]" />
        <div>
          <h2 className="text-2xl">{marca.name}</h2>
          <p className="mt-2 italic">Você vendeu {marca.sold}</p>
          <p className="mt-3"><span className="tag">{marca.build}</span></p>
        </div>
      </section>
      <Enigmas mesaId={mesaId} uid={uid} />
      <Editor mesaId={mesaId} uid={uid} inicial={iniciais} />
    </div>
  );
}

type Status = "ocioso" | "salvando" | "salvo" | "erro";

function Editor({ mesaId, uid, inicial }: { mesaId: string; uid: string; inicial: Notas }) {
  const [n, setN] = useState<Notas>(inicial);
  const [status, setStatus] = useState<Status>("ocioso");
  const sujo = useRef(false);
  const ultimo = useRef(n);

  const mudar = (p: Partial<Notas>) => {
    sujo.current = true;
    setN((a) => {
      const nova = { ...a, ...p };
      ultimo.current = nova;
      return nova;
    });
    setStatus("salvando");
  };

  useEffect(() => {
    if (!sujo.current) return;
    const t = setTimeout(() => {
      salvarNotas(mesaId, uid, n).then(() => setStatus("salvo"), () => setStatus("erro"));
    }, 700);
    return () => clearTimeout(t);
  }, [n, uid, mesaId]);

  // Não perde dados ao fechar/recarregar com alteração pendente.
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (status === "salvando") {
        salvarNotas(mesaId, uid, ultimo.current).catch(() => {});
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [status, uid, mesaId]);

  const novoPostit = () =>
    mudar({ postits: [...n.postits, { id: crypto.randomUUID(), text: "" }] });

  return (
    <>
      <p className="text-right text-sm dim" aria-live="polite">
        {status === "salvando" && "Gravando…"}
        {status === "salvo" && "Gravado ✓"}
        {status === "erro" && <span style={{ color: "var(--m-blood-hi)" }}>Não foi possível gravar. Tentando de novo ao editar.</span>}
      </p>

      <section className="grid gap-4 md:grid-cols-3">
        <Campo rotulo="Passiva" dica="o efeito constante que você sente sempre ativo" valor={n.passiva} onChange={(v) => mudar({ passiva: v })} />
        <Campo rotulo="Fardo" dica="o que a Marca lhe cobra, o custo que você paga" valor={n.fardo} onChange={(v) => mudar({ fardo: v })} />
        <Campo rotulo="Habilidade" dica="o que você consegue invocar quando decide usar a Marca" valor={n.habilidade} onChange={(v) => mudar({ habilidade: v })} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl">Evolução da Marca</h2>
          <button
            className="btn"
            onClick={() => mudar({ niveis: [...n.niveis, { id: crypto.randomUUID(), nome: "", gatilho: "", mudanca: "" }] })}
          >
            + Novo nível
          </button>
        </div>
        <p className="dim mb-3 text-sm">Cadastre os níveis que você acredita existirem e preencha o que acha que os dispara e o que muda. É a sua teoria.</p>
        {n.niveis.length === 0 ? (
          <p className="dim">Nenhum nível cadastrado ainda.</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table>
              <thead>
                <tr><th>Nível</th><th>Gatilho</th><th>O que muda</th><th aria-label="Ações" /></tr>
              </thead>
              <tbody>
                {n.niveis.map((v, i) => {
                  const set = (p: Partial<Nivel>) => mudar({ niveis: n.niveis.map((x) => (x.id === v.id ? { ...x, ...p } : x)) });
                  return (
                    <tr key={v.id}>
                      <td style={{ minWidth: "9rem" }}>
                        <input aria-label={`Nome do nível ${i + 1}`} value={v.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Nome / número" />
                      </td>
                      <td style={{ minWidth: "14rem" }}>
                        <textarea aria-label={`Gatilho do nível ${i + 1}`} style={{ minHeight: "4rem" }} value={v.gatilho} onChange={(e) => set({ gatilho: e.target.value })} />
                      </td>
                      <td style={{ minWidth: "14rem" }}>
                        <textarea aria-label={`O que muda no nível ${i + 1}`} style={{ minHeight: "4rem" }} value={v.mudanca} onChange={(e) => set({ mudanca: e.target.value })} />
                      </td>
                      <td>
                        <button className="text-xs underline dim" onClick={() => mudar({ niveis: n.niveis.filter((x) => x.id !== v.id) })}>remover</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl">Post-its</h2>
          <button className="btn" onClick={novoPostit}>+ Novo post-it</button>
        </div>
        {n.postits.length === 0 && <p className="dim">Nada anotado ainda. Pistas, teorias, o que ouviu em jogo…</p>}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {n.postits.map((p, i) => (
            <div key={p.id} className="postit" style={{ ["--rot" as string]: `${((i * 7) % 5) - 2}deg` }}>
              <textarea
                aria-label={`Post-it ${i + 1}`}
                value={p.text}
                onChange={(e) => mudar({ postits: n.postits.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)) })}
              />
              <button
                className="text-xs underline opacity-70 hover:opacity-100"
                onClick={() => mudar({ postits: n.postits.filter((x) => x.id !== p.id) })}
              >
                remover
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Campo({ rotulo, dica, valor, onChange }: { rotulo: string; dica: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="panel p-4">
      <label className="display gold block text-lg" htmlFor={rotulo}>{rotulo}</label>
      <p className="dim mb-2 text-sm">{dica}</p>
      <textarea id={rotulo} value={valor} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
