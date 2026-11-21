"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { chamarIa } from "@/lib/ia-cliente";
import { useMesas } from "@/lib/mesas";
import { verificarLlm } from "@/lib/mapas-ia/orquestrador";
import type { CampoConfig, TipoProvedor } from "@/lib/mapas-ia/tipos";

type Desc = { id: string; nome: string; tipo: TipoProvedor; credencialId: string; campos: CampoConfig[]; capacidades: Record<string, unknown> };
type Estado = {
  provedores: Desc[];
  config: {
    provedorImagemAtivo?: string | null;
    provedorLlmAtivo?: string | null;
    provedorSegmentacaoAtivo?: string | null;
    campos: Record<string, Record<string, string>>;
  };
  credenciais: Record<string, { configurada: boolean; ultimos4?: string }>;
};

const NOME_CRED: Record<string, string> = { google: "Google", anthropic: "Anthropic" };
const input = "w-full rounded-lg border border-border bg-transparent px-3 py-2";
const CHAVE_ATIVO = { imagem: "provedorImagemAtivo", llm: "provedorLlmAtivo", segmentacao: "provedorSegmentacaoAtivo" } as const;

export default function ConfigIa() {
  const [est, setEst] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    chamarIa<Estado>("config")
      .then((e) => vivo && setEst(e))
      .catch((e: Error) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, []);

  if (erro) return <p className="text-red-500">{erro}</p>;
  if (!est) return <p className="text-muted">Carregando…</p>;

  return (
    <div className="space-y-8">
      <Seletor est={est} tipo="imagem" titulo="Provedor de imagem" onSalvo={setEst} />
      <Seletor est={est} tipo="llm" titulo="Provedor de LLM (agente e análise de tema)" onSalvo={setEst} />
      <Seletor est={est} tipo="segmentacao" titulo="Segmentador (converter mapa de imagem em cena)" onSalvo={setEst} />
      <p className="text-sm text-muted">
        Imagem e LLM são independentes: você pode combinar fabricantes (ex.: Gemini para imagens e Claude como LLM). Provedores do
        mesmo fabricante compartilham uma única chave. As chaves são cifradas no servidor e nunca voltam para o navegador.
      </p>
      <PainelUso />
    </div>
  );
}

function Seletor({ est, tipo, titulo, onSalvo }: { est: Estado; tipo: TipoProvedor; titulo: string; onSalvo: (e: Estado) => void }) {
  const lista = est.provedores.filter((p) => p.tipo === tipo);
  const ativoId = est.config[CHAVE_ATIVO[tipo]] ?? "";
  const [sel, setSel] = useState(ativoId || lista[0]?.id || "");
  const p = lista.find((x) => x.id === sel);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!p) return null;
  const cred = est.credenciais[p.credencialId];
  const valor = (c: CampoConfig) => valores[c.chave] ?? est.config.campos[p.id]?.[c.chave] ?? c.padrao ?? "";
  const compartilha = est.provedores.filter((x) => x.credencialId === p.credencialId && x.id !== p.id);

  async function salvar(ativar: boolean) {
    setOcupado(true);
    setMsg(null);
    try {
      const segredos: Record<string, string> = {};
      const campos: Record<string, string> = {};
      for (const c of p!.campos) {
        const v = valores[c.chave];
        if (v === undefined) continue;
        if (c.tipo === "segredo") segredos[p!.credencialId] = v;
        else campos[c.chave] = v;
      }
      const corpo: Record<string, unknown> = { segredos, campos: { [p!.id]: campos } };
      if (ativar) corpo[CHAVE_ATIVO[tipo]] = p!.id;
      await chamarIa("config", { method: "PUT", corpo });
      setValores({});
      onSalvo(await chamarIa<Estado>("config"));
      setMsg({ ok: true, texto: ativar ? "Salvo e ativado." : "Salvo." });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    setMsg(null);
    try {
      if (Object.keys(valores).length) await salvar(false);
      const r = await chamarIa<{ ok: boolean; erro?: string; capacidades?: Record<string, unknown> }>("testar", { corpo: { provedorId: p!.id } });
      if (!r.ok) setMsg({ ok: false, texto: r.erro ?? "Falhou." });
      else setMsg({ ok: true, texto: `Conexão ok. Capacidades: ${descreverCapacidades(r.capacidades ?? {})}` });
    } catch (e) {
      setMsg({ ok: false, texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  const aviso = p.tipo === "llm" ? verificarLlm(p.capacidades as { visao: boolean; ferramentas: boolean }, "analise-tema") : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {ativoId && <span className="text-xs text-muted">Ativo: {lista.find((x) => x.id === ativoId)?.nome ?? ativoId}</span>}
      </div>
      <select className={input} value={sel} onChange={(e) => { setSel(e.target.value); setValores({}); setMsg(null); }}>
        {lista.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nome}
            {x.id === ativoId ? " (ativo)" : ""}
          </option>
        ))}
      </select>

      {p.campos.map((c) => (
        <label key={c.chave} className="block text-sm">
          <span className="mb-1 block">{c.rotulo}</span>
          {c.tipo === "segredo" ? (
            <input
              type="password"
              autoComplete="off"
              className={input}
              value={valores[c.chave] ?? ""}
              placeholder={cred?.configurada ? `configurada (…${cred.ultimos4})` : "cole a chave"}
              onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
            />
          ) : (
            <input className={input} value={valor(c)} onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })} />
          )}
          {c.tipo === "segredo" && compartilha.length > 0 && (
            <span className="text-xs text-muted">Compartilhada com: {compartilha.map((x) => x.nome).join(", ")}.</span>
          )}
          {c.ajuda && <span className="text-xs text-muted">{c.ajuda}</span>}
        </label>
      ))}

      <p className="text-xs text-muted">
        Credencial {NOME_CRED[p.credencialId] ?? p.credencialId}: {cred?.configurada ? "configurada" : "não configurada"}.
      </p>
      {aviso && !aviso.ok && (
        <p className="text-sm text-amber-500">
          {aviso.aviso} {aviso.alternativa}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button disabled={ocupado} onClick={() => salvar(true)} className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50">
          {p.id === ativoId ? "Salvar" : "Salvar e ativar"}
        </button>
        <button disabled={ocupado || (!cred?.configurada && !valores.apiKey)} onClick={testar} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-border/50 disabled:opacity-50">
          Testar conexão
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-500" : "text-red-500"}`}>{msg.texto}</p>}
    </section>
  );
}

function descreverCapacidades(c: Record<string, unknown>): string {
  return Object.entries(c)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : typeof v === "boolean" ? (v ? "sim" : "não") : String(v)}`)
    .join(" · ");
}

function PainelUso() {
  const { user } = useAuth();
  const { mesas } = useMesas();
  const minhas = mesas.filter((m) => m.donoUid === user?.uid);
  const [mesaId, setMesaId] = useState("");
  const [dado, setDado] = useState<{ periodo: string; uso: { total: number; porProvedor: Record<string, number> }; teto: number } | null>(null);
  const [teto, setTeto] = useState("");
  const [erro, setErro] = useState("");
  const id = mesaId || minhas[0]?.id || "";

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    chamarIa<NonNullable<typeof dado>>(`uso?mesaId=${encodeURIComponent(id)}`)
      .then((d) => vivo && (setDado(d), setTeto(String(d.teto)), setErro("")))
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, [id]);

  if (!minhas.length) return null;

  async function salvarTeto() {
    try {
      const d = await chamarIa<NonNullable<typeof dado>>("uso", { method: "PUT", corpo: { mesaId: id, teto: Number(teto) } });
      setDado(d);
      setErro("");
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="font-semibold">Uso e teto de gastos</h2>
      <select className={input} value={id} onChange={(e) => setMesaId(e.target.value)}>
        {minhas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
      {dado && (
        <>
          <p className="text-sm">
            Período {dado.periodo}: <b>{dado.uso.total}</b> de {dado.teto} gerações.
          </p>
          <ul className="text-sm text-muted">
            {Object.entries(dado.uso.porProvedor).map(([p, n]) => <li key={p}>{p}: {n}</li>)}
            {!Object.keys(dado.uso.porProvedor).length && <li>Nenhuma geração ainda.</li>}
          </ul>
          <div className="flex gap-2">
            <input type="number" min={0} className={`${input} max-w-32`} value={teto} onChange={(e) => setTeto(e.target.value)} />
            <button onClick={salvarTeto} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-border/50">Definir teto</button>
          </div>
        </>
      )}
      {erro && <p className="text-sm text-red-500">{erro}</p>}
    </section>
  );
}

export function CabecalhoIa() {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-2xl font-bold">Configurações de IA</h1>
      <Link href="/" className="text-sm text-muted hover:underline">← Voltar</Link>
    </header>
  );
}
