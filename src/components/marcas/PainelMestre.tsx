"use client";

import { useState } from "react";
import { MARCAS, indiceDaMarca, marcaPorId, type Lore, type Puzzle } from "@/lib/marcas-data";
import {
  atribuirMarca,
  removerAtribuicao,
  salvarLore,
  salvarPuzzle,
  useAtribuicoes,
  useJogadores,
  useLore,
  useTodasNotas,
} from "@/lib/marcas";
import EnigmasMestre from "./EnigmasMestre";
import Sigilo from "./Sigilo";

export default function PainelMestre({ mesaId }: { mesaId: string }) {
  const jogadores = useJogadores(mesaId);
  const atribuicoes = useAtribuicoes(mesaId);
  const notas = useTodasNotas(mesaId);
  const lores = useLore(mesaId);
  const [aberta, setAberta] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [importandoPuzzles, setImportandoPuzzles] = useState(false);

  const markDe = (uid: string) => atribuicoes.find((a) => a.uid === uid)?.markId ?? "";
  const donoDe = (markId: string) =>
    atribuicoes.filter((a) => a.markId === markId).map((a) => jogadores.find((j) => j.uid === a.uid)?.name ?? "jogador desconhecido");

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-xl">Jogadores</h2>
        {jogadores.length === 0 ? (
          <p className="dim">Ninguém abriu o site ainda. Os membros da mesa aparecem aqui ao abrir as Marcas.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {jogadores.map((j) => (
              <div key={j.uid} className="panel flex items-center gap-3 p-3">
                <span className="flex-1 truncate">{j.name}</span>
                <select
                  className="max-w-[16rem]"
                  aria-label={`Marca de ${j.name}`}
                  value={markDe(j.uid)}
                  onChange={(e) => (e.target.value ? atribuirMarca(mesaId, j.uid, e.target.value) : removerAtribuicao(mesaId, j.uid))}
                >
                  <option value="">— sem Marca —</option>
                  {MARCAS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">Enigmas</h2>
          <button className="btn ghost" onClick={() => setImportandoPuzzles((v) => !v)}>
            {importandoPuzzles ? "Fechar importação" : "Importar enigmas"}
          </button>
        </div>
        {importandoPuzzles && <ImportarJson mesaId={mesaId} tipo="puzzles" />}
        <EnigmasMestre mesaId={mesaId} />
      </section>

      <section>
        <h2 className="mb-3 text-xl">Anotações dos Marcados</h2>
        {atribuicoes.length === 0 && <p className="dim">Nenhuma Marca atribuída.</p>}
        <div className="space-y-4">
          {atribuicoes.map((a) => {
            const n = notas.find((x) => x.uid === a.uid)?.notas;
            const nome = jogadores.find((j) => j.uid === a.uid)?.name ?? a.uid;
            return (
              <details key={a.uid} className="panel p-4">
                <summary className="display cursor-pointer">
                  {nome} <span className="dim">— {marcaPorId(a.markId)?.name}</span>
                </summary>
                {!n ? (
                  <p className="dim mt-3">Ainda não escreveu nada.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {(["passiva", "fardo", "habilidade"] as const).map((k) => (
                      <div key={k}>
                        <h3 className="gold text-sm uppercase">{k}</h3>
                        <p className="whitespace-pre-wrap">{n[k] || <span className="dim">(vazio)</span>}</p>
                      </div>
                    ))}
                    <div className="overflow-x-auto">
                      <h3 className="gold text-sm uppercase">Evolução segundo o jogador ({n.niveis.length})</h3>
                      {n.niveis.length === 0 ? (
                        <p className="dim">(nenhum nível cadastrado)</p>
                      ) : (
                        <table className="mt-2">
                          <thead><tr><th>Nível</th><th>Gatilho</th><th>O que muda</th></tr></thead>
                          <tbody>
                            {n.niveis.map((v) => (
                              <tr key={v.id}><td>{v.nome}</td><td className="whitespace-pre-wrap">{v.gatilho}</td><td className="whitespace-pre-wrap">{v.mudanca}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div>
                      <h3 className="gold text-sm uppercase">Post-its ({n.postits.length})</h3>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {n.postits.map((p) => (
                          <div key={p.id} className="postit whitespace-pre-wrap p-3 text-base">{p.text || "…"}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">As Vinte Marcas</h2>
          <button className="btn ghost" onClick={() => setImportando((v) => !v)}>
            {importando ? "Fechar importação" : `Importar lore (${lores.length}/${MARCAS.length})`}
          </button>
        </div>
        {importando && <ImportarJson mesaId={mesaId} tipo="lore" />}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {MARCAS.map((m) => {
            const donos = donoDe(m.id);
            return (
              <button
                key={m.id}
                onClick={() => setAberta(aberta === m.id ? null : m.id)}
                className="panel p-3 text-left hover:border-[var(--m-gold)]"
                style={aberta === m.id ? { borderColor: "var(--m-gold)" } : undefined}
              >
                <Sigilo index={indiceDaMarca(m.id)} size={64} className="text-[var(--m-blood-hi)]" />
                <p className="display mt-2 text-sm">{m.name}</p>
                <p className="dim text-xs">{m.build}</p>
                <p className="mt-1 text-xs" style={{ color: donos.length ? "var(--m-gold)" : "var(--m-dim)" }}>
                  {donos.length ? donos.join(", ") : "Sem dono"}
                </p>
              </button>
            );
          })}
        </div>
        {aberta && <Gabarito markId={aberta} lore={lores.find((l) => l.id === aberta)?.lore} />}
      </section>
    </div>
  );
}

function Gabarito({ markId, lore }: { markId: string; lore?: Lore }) {
  const m = marcaPorId(markId)!;
  return (
    <article className="panel mt-4 space-y-4 p-5">
      <h2 className="text-2xl">{m.name} — gabarito do Mestre</h2>
      <p><span className="gold">Vendido:</span> {m.sold}</p>
      {!lore ? (
        <p className="dim">Lore desta Marca ainda não importada. Use “Importar lore”.</p>
      ) : (
        <>
          <div><h3 className="gold">Passiva — {lore.passivaNome}</h3><p className="whitespace-pre-wrap">{lore.passiva}</p></div>
          <div><h3 className="gold">Fardo</h3><p className="whitespace-pre-wrap">{lore.fardo}</p></div>
          <div><h3 className="gold">Habilidade — {lore.habilidadeNome}</h3><p className="whitespace-pre-wrap">{lore.habilidade}</p></div>
          <div className="overflow-x-auto">
            <h3 className="gold mb-2">Os Nove Círculos</h3>
            <table>
              <thead><tr><th>Círculo</th><th>Gatilho</th><th>O que muda</th></tr></thead>
              <tbody>
                {lore.circles?.map((c, i) => (
                  <tr key={i}><td>{c.circulo}</td><td>{c.gatilho}</td><td>{c.mudanca}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div><h3 className="gold">Remoção</h3><p className="whitespace-pre-wrap">{lore.remocao}</p></div>
        </>
      )}
    </article>
  );
}

const EXEMPLO = `{
  "eco-vazio": {
    "passivaNome": "...", "passiva": "...",
    "fardo": "...",
    "habilidadeNome": "...", "habilidade": "...",
    "circles": [ { "circulo": "...", "gatilho": "...", "mudanca": "..." } ],
    "remocao": "..."
  }
}`;

function ImportarJson({ mesaId, tipo }: { mesaId: string; tipo: "lore" | "puzzles" }) {
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState("");

  const importar = async () => {
    try {
      const obj = JSON.parse(texto) as Record<string, Lore & Puzzle>;
      const ids = Object.keys(obj);
      const invalidos = ids.filter((id) => !marcaPorId(id));
      if (!ids.length || invalidos.length) throw new Error(`ids inválidos: ${invalidos.join(", ") || "(vazio)"}`);
      await Promise.all(ids.map((id) => (tipo === "lore" ? salvarLore(mesaId, id, obj[id]) : salvarPuzzle(mesaId, id, obj[id]))));
      setMsg(`${ids.length} Marca(s) importada(s).`);
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <div className="panel mb-4 space-y-2 p-4">
      <p className="dim text-sm">
        Escolha o arquivo <code>{tipo === "lore" ? "lore-marcas.json" : "puzzles-marcas.json"}</code> ou cole um JSON {"{ markId: gabarito }"} (conteúdo de <code>as-cinco-marcas.md</code> convertido). Vai direto para <code>lore/&#123;markId&#125;</code>, que só o Mestre lê.
      </p>
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Arquivo lore-marcas.json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) setTexto(await f.text());
        }}
      />
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={EXEMPLO} style={{ minHeight: "10rem" }} />
      <div className="flex items-center gap-3">
        <button className="btn" onClick={importar}>Importar</button>
        <span className="text-sm">{msg}</span>
      </div>
    </div>
  );
}
