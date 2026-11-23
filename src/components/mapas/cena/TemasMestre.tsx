"use client";

import { useRef, useState } from "react";
import { uid } from "@/lib/mesas";
import { chamarIa } from "@/lib/ia-cliente";
import { enviarArquivo } from "@/lib/storage";
import { combinarPaletas } from "@/lib/mapas-ia/temas/paleta";
import { excluirTemaEmCascata, prepararReferencia, usoDoTema, salvarTema, useTemas } from "@/lib/mapas-ia/temas/temas";
import { MAX_REFERENCIAS_ANALISE } from "@/lib/mapas-ia/temas/analise";
import { linhasParaLista, normalizarPerfil, type PerfilEstilo, type Tema } from "@/lib/mapas-ia/temas/tipos";
import type { ImagemBase64 } from "@/lib/mapas-ia/tipos";

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted";
const btn = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-border/50 disabled:opacity-40";

type Ref = { arquivo: File; previa: string; paleta: string[]; imagem: ImagemBase64 };
type Rascunho = {
  id: string;
  nome: string;
  descricao: string;
  paleta: string[];
  regras: string;
  proibidos: string;
  geradoPorIA: boolean;
  referenciasSalvas: string[];
  ancoras: string[];
  criadoEm: number;
};

const vazio = (): Rascunho => ({ id: uid(), nome: "", descricao: "", paleta: [], regras: "", proibidos: "", geradoPorIA: false, referenciasSalvas: [], ancoras: [], criadoEm: Date.now() });
const doTema = (t: Tema): Rascunho => ({
  id: t.id,
  nome: t.nome,
  descricao: t.descricao,
  paleta: t.paleta,
  regras: t.regras.join("\n"),
  proibidos: t.proibidos.join("\n"),
  geradoPorIA: t.geradoPorIA,
  referenciasSalvas: t.referencias,
  ancoras: t.ancoras,
  criadoEm: t.criadoEm,
});

export default function TemasMestre({ mesaId, onFechar }: { mesaId: string; onFechar: () => void }) {
  const temas = useTemas(mesaId);
  const [r, setR] = useState<Rascunho | null>(null);
  const [erro, setErro] = useState("");

  const [apagar, setApagar] = useState<{ tema: Tema; mapas: number; assets: number } | null>(null);
  const [confirmacao, setConfirmacao] = useState("");
  const [apagando, setApagando] = useState(false);

  async function pedirExclusao(t: Tema) {
    setErro("");
    try {
      setApagar({ tema: t, ...(await usoDoTema(mesaId, t.id)) });
      setConfirmacao("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao verificar o uso do tema.");
    }
  }

  async function excluir() {
    if (!apagar) return;
    setApagando(true);
    setErro("");
    try {
      await excluirTemaEmCascata(mesaId, apagar.tema);
      setApagar(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setApagando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{r ? (r.nome ? `Tema: ${r.nome}` : "Novo tema") : "Temas da mesa"}</h3>
          <button className={btn} onClick={r ? () => setR(null) : onFechar}>{r ? "Voltar" : "Fechar"}</button>
        </div>
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        {apagar && !r && (
          <div className="space-y-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm">
            <p>
              Excluir o tema <strong>{apagar.tema.nome}</strong> apaga também, <strong>sem volta</strong>: {apagar.mapas} mapa(s) de cena que o usam
              (com a cena e a imagem) e {apagar.assets} asset(s) do tema.
            </p>
            <p className="text-muted">Para confirmar, digite o nome do tema:</p>
            <input className={campo} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={apagar.tema.nome} autoFocus />
            <div className="flex justify-end gap-2">
              <button className={btn} onClick={() => setApagar(null)} disabled={apagando}>Cancelar</button>
              <button
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                disabled={apagando || confirmacao !== apagar.tema.nome}
                onClick={excluir}
              >
                {apagando ? "Excluindo…" : "Excluir tudo"}
              </button>
            </div>
          </div>
        )}
        {r ? (
          <EditorTema mesaId={mesaId} inicial={r} onSalvo={() => setR(null)} />
        ) : (
          <>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover" onClick={() => setR(vazio())}>
              + Novo tema
            </button>
            {temas.length === 0 && <p className="text-sm text-muted">Nenhum tema ainda. Um tema define a identidade visual dos mapas da mesa.</p>}
            <ul className="space-y-2">
              {temas.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <div className="flex h-6 w-24 shrink-0 overflow-hidden rounded">
                    {t.paleta.map((c) => (
                      <span key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.nome}</p>
                    <p className="truncate text-xs text-muted">{t.descricao}</p>
                  </div>
                  <button className={btn} onClick={() => setR(doTema(t))}>Editar</button>
                  <button className={`${btn} text-red-500`} onClick={() => pedirExclusao(t)}>Excluir</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function EditorTema({ mesaId, inicial, onSalvo }: { mesaId: string; inicial: Rascunho; onSalvo: () => void }) {
  const [r, setR] = useState(inicial);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [texto, setTexto] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const mut = (p: Partial<Rascunho>) => setR((x) => ({ ...x, ...p }));

  async function adicionar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setErro("");
    try {
      const novas: Ref[] = [];
      for (const arquivo of Array.from(arquivos).slice(0, MAX_REFERENCIAS_ANALISE - refs.length)) {
        const { paleta, imagem } = await prepararReferencia(arquivo);
        novas.push({ arquivo, previa: URL.createObjectURL(arquivo), paleta, imagem });
      }
      const todas = [...refs, ...novas];
      setRefs(todas);
      // Paleta local: aparece sem chamar IA.
      mut({ paleta: combinarPaletas(todas.map((x) => x.paleta)) });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ler a imagem.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  function remover(i: number) {
    const todas = refs.filter((_, k) => k !== i);
    setRefs(todas);
    if (todas.length) mut({ paleta: combinarPaletas(todas.map((x) => x.paleta)) });
  }

  async function analisar() {
    setAnalisando(true);
    setErro("");
    setMsg("");
    try {
      const { perfil } = await chamarIa<{ perfil: PerfilEstilo }>("analisar-tema", {
        corpo: { mesaId, texto, referencias: refs.map((x) => x.imagem) },
      });
      const p = normalizarPerfil(perfil);
      // É uma PROPOSTA: preenche o formulário, mas só persiste quando o mestre salvar.
      mut({
        descricao: p.descricao,
        regras: p.regras.join("\n"),
        proibidos: p.proibidos.join("\n"),
        paleta: p.paleta.length ? p.paleta : r.paleta,
        geradoPorIA: true,
      });
      setMsg("Proposta da IA carregada. Revise, edite e salve.");
    } catch (e) {
      setErro((e instanceof Error ? e.message : "Falha na análise."));
    } finally {
      setAnalisando(false);
    }
  }

  async function salvar() {
    if (!r.nome.trim()) return setErro("Dê um nome ao tema.");
    setSalvando(true);
    setErro("");
    try {
      const novas = await Promise.all(refs.map((x) => enviarArquivo(mesaId, "refs", x.arquivo, x.arquivo.type === "image/png" ? "png" : x.arquivo.type === "image/webp" ? "webp" : "jpg")));
      const perfil = normalizarPerfil({ descricao: r.descricao, paleta: r.paleta, regras: linhasParaLista(r.regras), proibidos: linhasParaLista(r.proibidos) });
      const tema: Tema = {
        id: r.id,
        nome: r.nome.trim().slice(0, 80),
        ...perfil,
        ancoras: r.ancoras,
        referencias: [...r.referenciasSalvas, ...novas],
        geradoPorIA: r.geradoPorIA,
        criadoEm: r.criadoEm,
      };
      await salvarTema(mesaId, tema);
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o tema.");
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3">
      <input className={campo} placeholder="Nome do tema" value={r.nome} onChange={(e) => mut({ nome: e.target.value })} />

      <section className="space-y-2 rounded-lg border border-border p-2">
        <h4 className="text-xs uppercase tracking-wider text-muted">Referências e análise (opcional)</h4>
        <div className="flex flex-wrap gap-2">
          {r.referenciasSalvas.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="Referência" className="h-16 w-16 rounded object-cover" />
          ))}
          {refs.map((x, i) => (
            <button key={x.previa} type="button" title="Remover" onClick={() => remover(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.previa} alt="Referência nova" className="h-16 w-16 rounded object-cover" />
            </button>
          ))}
          {refs.length < MAX_REFERENCIAS_ANALISE && (
            <button type="button" className="h-16 w-16 rounded border border-dashed border-border text-xl text-muted" onClick={() => input.current?.click()}>+</button>
          )}
        </div>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => adicionar(e.target.files)} />
        <textarea className={campo} rows={2} placeholder="Descreva o estilo desejado (ex.: pintura a óleo sombria, cores terrosas)" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button className={btn} onClick={analisar} disabled={analisando || (refs.length === 0 && !texto.trim())}>
          {analisando ? "Analisando…" : "Analisar com IA"}
        </button>
        <p className="text-xs text-muted">Sem LLM configurado? Preencha o perfil abaixo à mão. Nada da IA é salvo sem a sua confirmação.</p>
      </section>

      {msg && <p className="text-sm text-green-500">{msg}</p>}

      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wider text-muted">Perfil de estilo</h4>
        <textarea className={campo} rows={3} placeholder="Descrição do estilo" value={r.descricao} onChange={(e) => mut({ descricao: e.target.value })} />
        <div className="flex flex-wrap items-center gap-1.5">
          {r.paleta.map((c, i) => (
            <label key={i} className="relative">
              <input type="color" value={c} className="h-8 w-8 cursor-pointer rounded" onChange={(e) => mut({ paleta: r.paleta.map((x, k) => (k === i ? e.target.value : x)) })} />
            </label>
          ))}
          {r.paleta.length < 8 && (
            <button type="button" className={btn} onClick={() => mut({ paleta: [...r.paleta, "#888888"] })}>+ cor</button>
          )}
          {r.paleta.length > 0 && (
            <button type="button" className={btn} onClick={() => mut({ paleta: r.paleta.slice(0, -1) })}>− cor</button>
          )}
        </div>
        <label className="block text-xs text-muted">
          Regras (uma por linha)
          <textarea className={campo} rows={3} value={r.regras} onChange={(e) => mut({ regras: e.target.value })} />
        </label>
        <label className="block text-xs text-muted">
          Termos proibidos (um por linha)
          <textarea className={campo} rows={2} value={r.proibidos} onChange={(e) => mut({ proibidos: e.target.value })} />
        </label>
      </section>

      {erro && <p className="text-sm text-red-500">{erro}</p>}
      <div className="flex justify-end">
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar tema"}
        </button>
      </div>
    </div>
  );
}
