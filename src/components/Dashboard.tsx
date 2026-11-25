"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { KeyRound, Plus, Search, Settings2, Sparkles } from "lucide-react";
import { LogoIcone } from "./Logo";
import { sair, useAuth } from "@/lib/auth";
import { excluirMesa, sairDaMesa, useMesas, type Mesa, type Status } from "@/lib/mesas";
import ThemeToggle from "./ThemeToggle";
import CardMesa from "./dashboard/CardMesa";
import EntrarDialog from "./dashboard/EntrarDialog";
import NovaMesaWizard from "./dashboard/NovaMesaWizard";
import { confirmar } from "./ui/Dialogos";

type Aba = "ativas" | "planejando" | "arquivo";
const ABAS: { id: Aba; rotulo: string; status: Status[] }[] = [
  { id: "ativas", rotulo: "Ativas", status: ["ativa"] },
  { id: "planejando", rotulo: "Em planejamento", status: ["planejando"] },
  { id: "arquivo", rotulo: "Arquivo", status: ["pausada", "encerrada"] },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Dashboard() {
  const { user } = useAuth();
  const { mesas, pronto } = useMesas();
  const uid = user?.uid ?? "";
  const [agora] = useState(() => Date.now());
  const [papel, setPapel] = useState<"mestre" | "jogador" | null>(null);
  const [aba, setAba] = useState<Aba | null>(null);
  const [busca, setBusca] = useState("");
  const [novaMesa, setNovaMesa] = useState(false);
  const [entrando, setEntrando] = useState(false);

  async function remover(mesa: Mesa) {
    const dono = mesa.donoUid === uid;
    const ok = await confirmar({
      perigo: true,
      titulo: dono ? "Excluir mesa" : "Sair da mesa",
      texto: dono
        ? `"${mesa.nome}" será excluída para todos os jogadores. Isso não pode ser desfeito.`
        : `Você deixará de ver "${mesa.nome}". Poderá voltar com o código de convite.`,
      confirmar: dono ? "Excluir" : "Sair",
    });
    if (ok) await (dono ? excluirMesa(mesa) : sairDaMesa(mesa, uid));
  }

  const minhas = useMemo(() => mesas.filter((m) => m.donoUid === uid), [mesas, uid]);
  const jogadas = useMemo(() => mesas.filter((m) => m.donoUid !== uid), [mesas, uid]);

  // Papel padrão: mestre; cai para "jogador" se só joga em mesas de outros.
  const papelAtivo = papel ?? (minhas.length === 0 && jogadas.length > 0 ? "jogador" : "mestre");

  const contagem = (a: Aba) => minhas.filter((m) => ABAS.find((x) => x.id === a)!.status.includes(m.status)).length;
  // Aba padrão: "Ativas", ou a primeira que tiver mesa.
  const abaAtiva: Aba = aba ?? (["ativas", "planejando", "arquivo"] as Aba[]).find((a) => contagem(a) > 0) ?? "ativas";

  const q = norm(busca.trim());
  const filtra = (m: Mesa) => !q || norm(m.nome).includes(q) || norm(m.sistema).includes(q);
  const lista =
    papelAtivo === "mestre"
      ? minhas.filter((m) => ABAS.find((a) => a.id === abaAtiva)!.status.includes(m.status) && filtra(m))
      : jogadas.filter(filtra);

  const nome = (user?.displayName || user?.email || "").split(/[ @]/)[0];

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_50%_-20%,color-mix(in_srgb,var(--accent)_28%,transparent),transparent_70%)]" />

      <header className="border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-wide">
            <LogoIcone altura={30} /> RPG Workspace
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/configuracoes/ia" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground" title="Configurar IA">
              <Settings2 size={16} /> <span className="hidden sm:inline">IA</span>
            </Link>
            <ThemeToggle />
            <span className="ml-1 hidden text-sm text-muted sm:inline">{user?.displayName || user?.email}</span>
            <button onClick={sair} className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground">Sair</button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="anim-surgir mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wide sm:text-4xl">{nome ? `Olá, ${nome}` : "Suas mesas"}</h1>
            <p className="mt-1 text-muted">Qual mesa você abre hoje?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEntrando(true)} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-medium hover:border-accent-hover hover:bg-card">
              <KeyRound size={16} /> Entrar com código
            </button>
            <button onClick={() => setNovaMesa(true)} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white shadow-lg shadow-accent/25 hover:bg-accent-strong">
              <Plus size={16} /> Nova mesa
            </button>
          </div>
        </div>

        {/* Papel: o que eu mestro × o que eu jogo */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border bg-card p-1" role="tablist" aria-label="Papel">
            {([["mestre", "Mesas que mestro", minhas.length], ["jogador", "Mesas que jogo", jogadas.length]] as const).map(([id, rotulo, n]) => (
              <button
                key={id}
                role="tab"
                aria-selected={papelAtivo === id}
                onClick={() => setPapel(id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${papelAtivo === id ? "bg-accent text-white shadow-md shadow-accent/30" : "text-muted hover:text-foreground"}`}
              >
                {rotulo} <span className="ml-1 opacity-70">{n}</span>
              </button>
            ))}
          </div>
          <label className="relative block w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou sistema…"
              aria-label="Buscar mesas"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </label>
        </div>

        {papelAtivo === "mestre" && (
          <div className="mb-6 flex gap-1 border-b border-border" role="tablist">
            {ABAS.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={abaAtiva === a.id}
                onClick={() => setAba(a.id)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${abaAtiva === a.id ? "border-accent text-accent-hover" : "border-transparent text-muted hover:text-foreground"}`}
              >
                {a.rotulo}
                <span className="rounded-full bg-card-2 px-2 py-0.5 text-xs">{contagem(a.id)}</span>
              </button>
            ))}
          </div>
        )}

        {!pronto ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <li key={i} className="h-64 animate-pulse rounded-2xl bg-card-2" />)}
          </ul>
        ) : lista.length === 0 ? (
          <Vazio papel={papelAtivo} buscando={!!q} semMesas={mesas.length === 0} onNova={() => setNovaMesa(true)} onEntrar={() => setEntrando(true)} />
        ) : (
          <ul key={`${papelAtivo}-${abaAtiva}`} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((m, i) => (
              <CardMesa key={m.id} mesa={m} mestre={m.donoUid === uid} agora={agora} atraso={i * 60} onRemover={() => remover(m)} />
            ))}
          </ul>
        )}
      </main>

      {novaMesa && user && <NovaMesaWizard uid={user.uid} onClose={() => setNovaMesa(false)} />}
      {entrando && user && <EntrarDialog uid={user.uid} onClose={() => setEntrando(false)} />}
    </div>
  );
}

function Vazio({ papel, buscando, semMesas, onNova, onEntrar }: { papel: "mestre" | "jogador"; buscando: boolean; semMesas: boolean; onNova: () => void; onEntrar: () => void }) {
  return (
    <div className="anim-surgir rounded-2xl border border-dashed border-border p-12 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-card-2 text-gold" style={{ animation: "flutuar 5s ease-in-out infinite" }}>
        <Sparkles size={26} />
      </div>
      {buscando ? (
        <p className="text-lg font-medium">Nenhuma mesa encontrada para essa busca.</p>
      ) : semMesas ? (
        <>
          <p className="font-display text-xl">Sua aventura começa aqui</p>
          <p className="mx-auto mt-1 max-w-sm text-muted">Crie a primeira mesa como mestre ou entre na de um amigo com um código de convite.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={onNova} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong">Criar mesa</button>
            <button onClick={onEntrar} className="rounded-lg border border-border px-4 py-2 hover:bg-card">Tenho um código</button>
          </div>
        </>
      ) : papel === "jogador" ? (
        <p className="text-muted">Você ainda não joga em nenhuma mesa. Peça o código de convite ao seu mestre.</p>
      ) : (
        <p className="text-muted">Nenhuma mesa nesta aba.</p>
      )}
    </div>
  );
}
