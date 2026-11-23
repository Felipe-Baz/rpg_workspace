"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeftRight, Bell, ChevronDown, Dices, Search, X as Fechar, ChevronsLeft, ChevronsRight, Menu, Plus, X } from "lucide-react";
import { sair, useAuth } from "@/lib/auth";
import { STATUS_LABEL, useMesas, type Mesa } from "@/lib/mesas";
import ThemeToggle from "../ThemeToggle";
import AutomacoesHost from "../extensoes/AutomacoesHost";
import PainelDados from "../sessao/PainelDados";
import PaletaComandos from "./PaletaComandos";
import type { ExtensaoMesa } from "@/lib/extensoes/dados";
import { variaveisDoTema, type EfeitosCombinados } from "@/lib/extensoes/efeitos";
import type { ConfigNativas } from "@/lib/extensoes/nativas";
import { ExtensoesProvider } from "./ExtensoesContext";
import { MesaProvider } from "./MesaContext";
import type { GrupoNav, ItemNav } from "./navegacao";

/* ---- preferência "sidebar recolhida" (persistida, sem estado em efeito) ---- */
const CHAVE = "sidebar-recolhida";
const ouvintes = new Set<() => void>();
const lerRecolhida = () => {
  try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; }
};
const assinarRecolhida = (cb: () => void) => { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; };
function alternarRecolhida() {
  try { localStorage.setItem(CHAVE, lerRecolhida() ? "0" : "1"); } catch {}
  ouvintes.forEach((f) => f());
}

const ativo = (pathname: string, href: string, exato: boolean) => (exato ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

import { combinarEfeitos } from "@/lib/extensoes/efeitos";
const SEM_EFEITOS = combinarEfeitos([]);

/**
 * Aplica o tema da mesa nas variáveis CSS da página enquanto o usuário está nela (e só nela).
 * Reaplica ao trocar entre tema claro e escuro; ao sair, devolve o tema padrão.
 */
function useTemaDaMesa(tema: EfeitosCombinados["tema"]) {
  const chave = JSON.stringify(tema);
  useEffect(() => {
    const raiz = document.documentElement;
    const t = JSON.parse(chave) as EfeitosCombinados["tema"];
    let aplicadas: string[] = [];
    const limpar = () => { aplicadas.forEach((v) => raiz.style.removeProperty(v)); aplicadas = []; };
    const aplicar = () => {
      limpar();
      const modo = raiz.dataset.theme === "light" ? "claro" : "escuro";
      for (const [k, v] of variaveisDoTema(t[modo])) { raiz.style.setProperty(k, v); aplicadas.push(k); }
    };
    aplicar();
    const o = new MutationObserver(aplicar);
    o.observe(raiz, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { o.disconnect(); limpar(); };
  }, [chave]);
}

export type Aviso = { texto: string; href: string };

type Props = {
  mesa: Mesa;
  modo: "mestre" | "jogador";
  inicio: ItemNav;
  grupos: GrupoNav[];
  rodape: ItemNav[];
  nativas?: { config: ConfigNativas; prontas: boolean; souMestre: boolean }; // escolhas do mestre sobre as extensões nativas
  extensoes?: ExtensaoMesa[];
  efeitos?: EfeitosCombinados; // tema, termos, menu e tipos de dado vindos das extensões ativas // extensões instaladas (já filtradas pelo papel), para os encaixes
  destaque?: ItemNav; // ação principal da sidebar (ex.: Iniciar sessão)
  badges?: Record<string, number>; // href → novidades não vistas
  avisos?: Aviso[]; // lista do sino
  children: React.ReactNode;
};

// Casca visual do workspace (sidebar agrupada + topbar), usada pela visão do mestre e do jogador.
export default function ShellBase({ mesa, modo, inicio, grupos: gruposBrutos, rodape, extensoes = [], efeitos = SEM_EFEITOS, nativas = { config: {}, prontas: true, souMestre: modo === "mestre" }, destaque, badges = {}, avisos = [], children }: Props) {
  const { user } = useAuth();
  const { mesas } = useMesas();
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false); // drawer no mobile
  const [sino, setSino] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [rolador, setRolador] = useState(false);

  // Atalho global: Ctrl/⌘ + K abre a busca.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaleta((v) => !v); }
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, []);
  const recolhida = useSyncExternalStore(assinarRecolhida, lerRecolhida, () => false);

    // Menu da mesa: extensões podem ocultar ferramentas e trocar nomes (Início, Extensões e Configurações são protegidos).
  const grupos = gruposBrutos
    .map((g) => ({
      ...g,
      itens: g.itens
        .filter((i) => !(i.chave && efeitos.ocultar.has(i.chave as never)))
        .map((i) => ((i.chave && efeitos.termos[i.chave as never]) ? { ...i, rotulo: efeitos.termos[i.chave as never] as string } : i)),
    }))
    .filter((g) => g.itens.length > 0);
  useTemaDaMesa(efeitos.tema);

  const todos: ItemNav[] = [inicio, ...(destaque ? [destaque] : []), ...grupos.flatMap((g) => g.itens), ...rodape];
  const atual = todos.find((i) => ativo(pathname, i.href, i.href === inicio.href));
  const rotuloAtual = atual?.rotulo ?? "";
  const fechar = () => setAberto(false);

  return (
    <MesaProvider value={mesa}>
      <ExtensoesProvider value={{ extensoes, papel: modo, base: inicio.href, nativas: nativas.config, nativasProntas: nativas.prontas, souMestre: nativas.souMestre, efeitos }}>
      <div className="flex min-h-screen">
        {aberto && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={fechar} />}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-[transform,width] duration-300 [transition-timing-function:var(--ease)] md:sticky md:top-0 md:h-screen md:translate-x-0 ${
            aberto ? "translate-x-0" : "-translate-x-full"
          } ${recolhida ? "md:w-[4.25rem]" : "md:w-64"}`}
        >
          <CabecalhoMesa mesa={mesa} modo={modo} recolhida={recolhida} uid={user?.uid ?? ""} mesas={mesas} onFechar={fechar} />

          <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-3">
            {destaque && (
              <Link
                href={destaque.href}
                onClick={fechar}
                title={recolhida ? destaque.rotulo : undefined}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-hover px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/30 hover:brightness-110"
              >
                <destaque.icone size={18} className="shrink-0" />
                {!recolhida && destaque.rotulo}
              </Link>
            )}
            <LinkNav item={inicio} pathname={pathname} exato recolhida={recolhida} badge={badges[inicio.href]} onClick={fechar} />
            {grupos.map((g) => (
              <div key={g.titulo}>
                {!recolhida ? (
                  <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{g.titulo}</p>
                ) : (
                  <div className="mx-3 mb-1 border-t border-border" />
                )}
                <div className="space-y-0.5">
                  {g.itens.map((i) => (
                    <LinkNav key={i.href} item={i} pathname={pathname} recolhida={recolhida} badge={badges[i.href]} onClick={fechar} />
                  ))}
                  {modo === "mestre" && g.titulo === "Extensões" && (
                    <Link href={`${inicio.href}/extensoes/criar`} onClick={fechar} title={recolhida ? "Criar extensão" : undefined} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ext hover:bg-ext/10">
                      <Plus size={18} className="shrink-0" />
                      {!recolhida && <span>Criar extensão</span>}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </nav>

          <div className="space-y-0.5 border-t border-border px-2 py-2">
            {rodape.map((i) => (
              <LinkNav key={i.href} item={i} pathname={i.troca ? "" : pathname} recolhida={recolhida} onClick={fechar} />
            ))}
            <button
              onClick={alternarRecolhida}
              className="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-card-2 hover:text-foreground md:flex"
              aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
            >
              {recolhida ? <ChevronsRight size={18} className="shrink-0" /> : <ChevronsLeft size={18} className="shrink-0" />}
              {!recolhida && <span>Recolher</span>}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
            <button onClick={() => setAberto(true)} className="rounded-lg p-1.5 text-muted hover:text-foreground md:hidden" aria-label="Abrir menu">
              <Menu size={20} />
            </button>
            <nav aria-label="Você está em" className="flex min-w-0 items-center gap-2 text-sm">
              <Link href="/mesas" className="text-muted hover:text-foreground">Mesas</Link>
              <span className="text-muted/50">/</span>
              <Link href={inicio.href} className="max-w-[10rem] truncate text-muted hover:text-foreground">{mesa.nome || "Sem nome"}</Link>
              {rotuloAtual && rotuloAtual !== inicio.rotulo && (
                <>
                  <span className="text-muted/50">/</span>
                  <span className="truncate font-medium">{rotuloAtual}</span>
                </>
              )}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setPaleta(true)} aria-label="Buscar (Ctrl+K)" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-2.5 text-sm text-muted hover:text-foreground sm:w-48">
                <Search size={15} /> <span className="hidden flex-1 text-left sm:inline">Buscar…</span>
                <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">Ctrl K</kbd>
              </button>
              {modo === "jogador" && (
                <div className="relative">
                  <button onClick={() => setSino(!sino)} aria-label={`Novidades (${avisos.length})`} aria-expanded={sino} className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground">
                    <Bell size={16} />
                    {avisos.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{avisos.length}</span>}
                  </button>
                  {sino && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setSino(false)} />
                      <div className="anim-surgir absolute right-0 top-11 z-20 w-72 space-y-0.5 rounded-xl border border-border bg-card p-1.5 shadow-2xl">
                        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted">Liberado pelo mestre</p>
                        {avisos.length === 0 && <p className="px-3 pb-3 text-sm text-muted">Nada novo por enquanto.</p>}
                        {avisos.map((a) => (
                          <Link key={a.href + a.texto} href={a.href} onClick={() => setSino(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-card-2">{a.texto}</Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <span className="hidden text-sm text-muted sm:inline">{user?.displayName || user?.email}</span>
              <ThemeToggle />
              <button onClick={sair} className="rounded-lg px-2 py-1.5 text-sm text-muted hover:text-foreground">Sair</button>
            </div>
          </header>

          <main id="conteudo" tabIndex={-1} key={pathname} className={`anim-surgir mx-auto w-full flex-1 px-4 py-8 sm:px-8 ${pathname.endsWith("/marcas") ? "max-w-7xl" : "max-w-5xl"}`}>{children}</main>
        </div>
      </div>
      {/* Rolador de dados flutuante (disponível em qualquer tela da mesa) */}
      <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
        {rolador && (
          <div className="anim-surgir w-80 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Dados</h2>
              <button onClick={() => setRolador(false)} aria-label="Fechar rolador" className="text-muted hover:text-foreground"><Fechar size={16} /></button>
            </div>
            <PainelDados mesaId={mesa.id} compacto />
          </div>
        )}
        <button
          onClick={() => setRolador(!rolador)}
          aria-label="Rolador de dados"
          aria-expanded={rolador}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-xl shadow-accent/40 hover:bg-accent-strong hover:rotate-12"
        >
          <Dices size={22} />
        </button>
      </div>

      {modo === "mestre" && <AutomacoesHost />}

      {paleta && (
        <PaletaComandos
          mesa={mesa}
          modo={modo}
          base={inicio.href}
          itens={[inicio, ...(destaque ? [destaque] : []), ...grupos.flatMap((g) => g.itens), ...rodape]}
          outrasMesas={mesas.filter((m) => m.id !== mesa.id && (modo === "jogador" ? m.donoUid !== (user?.uid ?? "") : m.donoUid === (user?.uid ?? "")))}
          onFechar={() => setPaleta(false)}
          onRolador={() => setRolador(true)}
        />
      )}
      </ExtensoesProvider>
    </MesaProvider>
  );
}

function LinkNav({ item, pathname, exato = false, recolhida, badge, onClick }: { item: ItemNav; pathname: string; exato?: boolean; recolhida: boolean; badge?: number; onClick: () => void }) {
  const on = ativo(pathname, item.href, exato);
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={recolhida ? item.rotulo : undefined}
      aria-current={on ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        on ? "bg-accent/15 font-medium text-accent-soft" : "text-muted hover:bg-card-2 hover:text-foreground"
      }`}
    >
      {on && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent-hover" />}
      <span className="relative shrink-0">
        <Icone size={18} className={item.ext ? "text-ext" : ""} />
        {!!badge && recolhida && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent" />}
      </span>
      {!recolhida && (
        <>
          <span className="truncate">{item.rotulo}</span>
          {item.ext && <span className="ml-auto rounded border border-ext/40 px-1.5 text-[10px] text-ext">Extensão</span>}
          {!!badge && <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] font-bold text-white" style={{ animation: "brilho 2s infinite" }}>{badge} novo{badge > 1 ? "s" : ""}</span>}
        </>
      )}
    </Link>
  );
}

// Eixo "onde estou": nome da mesa + seletor para trocar de mesa (separado do menu de ferramentas).
function CabecalhoMesa({ mesa, modo, recolhida, uid, mesas, onFechar }: { mesa: Mesa; modo: "mestre" | "jogador"; recolhida: boolean; uid: string; mesas: Mesa[]; onFechar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const outras = mesas.filter((m) => m.id !== mesa.id && (modo === "jogador" ? m.donoUid !== uid : m.donoUid === uid) && (m.status === "ativa" || m.status === "planejando"));
  const destino = (m: Mesa) => (modo === "jogador" ? `/mesas/${m.id}/jogador` : `/mesas/${m.id}`);

  return (
    <div className="relative border-b border-border p-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setAberto(!aberto)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-card-2"
          aria-expanded={aberto}
          title={recolhida ? mesa.nome : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold text-white" style={{ background: mesa.cor }}>
            {(mesa.nome || "?").trim().charAt(0).toUpperCase()}
          </span>
          {!recolhida && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{mesa.nome || "Sem nome"}</span>
                <span className="block truncate text-xs text-muted">{modo === "jogador" ? "Visão do jogador" : STATUS_LABEL[mesa.status]}{modo === "mestre" && mesa.sistema ? ` · ${mesa.sistema}` : ""}</span>
              </span>
              <ChevronDown size={16} className={`shrink-0 text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
            </>
          )}
        </button>
        <button onClick={onFechar} className="rounded-lg p-1.5 text-muted hover:text-foreground md:hidden" aria-label="Fechar menu"><X size={18} /></button>
      </div>

      {aberto && (
        <div className="anim-surgir absolute left-2 right-2 top-full z-50 mt-1 min-w-52 space-y-0.5 rounded-xl border border-border bg-card p-1.5 shadow-2xl">
          {outras.length === 0 && <p className="px-3 py-2 text-xs text-muted">Nenhuma outra mesa ativa.</p>}
          {outras.map((m) => (
            <Link key={m.id} href={destino(m)} onClick={() => { setAberto(false); onFechar(); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-card-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: m.cor }} />
              <span className="truncate">{m.nome || "Sem nome"}</span>
            </Link>
          ))}
          <Link href="/mesas" onClick={() => setAberto(false)} className="flex items-center gap-2 rounded-lg border-t border-border px-3 py-2 text-sm text-muted hover:bg-card-2 hover:text-foreground">
            <ArrowLeftRight size={14} /> Todas as mesas
          </Link>
        </div>
      )}
    </div>
  );
}

export function Carregando() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 space-y-3 border-r border-border bg-surface p-4 md:block">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-card-2" />)}
      </div>
      <div className="flex-1 space-y-4 p-8">
        <div className="h-8 w-1/3 animate-pulse rounded-lg bg-card-2" />
        <div className="h-40 animate-pulse rounded-xl bg-card-2" />
      </div>
    </div>
  );
}
