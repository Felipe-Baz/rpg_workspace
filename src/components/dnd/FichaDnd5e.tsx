"use client";

import { useState } from "react";
import { BedDouble, Heart, Minus, Plus, Shield, Star, Swords, Trash2, Wind } from "lucide-react";
import { uid } from "@/lib/mesas";
import { useFichaPersonagem } from "@/lib/fichaPersonagem";
import {
  ATRIBUTOS, ATRIBUTO_NOME, PERICIAS, bonusAtaqueMagia, bonusIniciativa, bonusPericia, bonusProficiencia, bonusSalvaguarda, cdMagia,
  MAX_DESCANSOS_CURTOS, comSinal, curar, temDadoVida, descansoCurto, descansoLongo, podeDescansoCurto, testeDadoVida, espacosPorNivel, modDe, percepcaoPassiva, pesoTotal, testeAtaque, testeAtaqueMagia, testeAtributo,
  testeDano, testeDanoMagia, testeIniciativa, testePericia, testeSalvaguarda, type Atributo, type Ataque, type FichaDnd, type Item, type Magia, type NivelProf, type Teste,
} from "@/lib/dnd5e";
import LivroHistoria from "./LivroHistoria";
import PainelRolagem from "./PainelRolagem";

const campo = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const cartao = "rounded-2xl border border-border bg-card p-4";
const titulo = "mb-3 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.2em] text-gold";
const botaoRolar = "rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-sm font-semibold text-gold hover:bg-gold/20";
const ABREV: Record<Atributo, string> = { for: "FOR", des: "DES", con: "CON", int: "INT", sab: "SAB", car: "CAR" };

function Num({ valor, onChange, min, className = "" }: { valor: number; onChange: (n: number) => void; min?: number; className?: string }) {
  return (
    <input
      type="number"
      value={Number.isFinite(valor) ? valor : 0}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) ? (min !== undefined ? Math.max(min, n) : n) : 0);
      }}
      className={`${campo} text-center ${className}`}
    />
  );
}

const Texto = ({ rotulo, valor, onChange, linhas = 4 }: { rotulo: string; valor: string; onChange: (v: string) => void; linhas?: number }) => (
  <label className="block text-sm">
    <span className="text-xs uppercase tracking-wider text-muted">{rotulo}</span>
    <textarea value={valor} onChange={(e) => onChange(e.target.value)} rows={linhas} className={`${campo} mt-1 resize-y`} />
  </label>
);

type Aba = "combate" | "magias" | "tracos" | "inventario" | "personagem" | "historia";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "combate", rotulo: "Combate" }, { id: "magias", rotulo: "Magias" }, { id: "tracos", rotulo: "Traços" },
  { id: "inventario", rotulo: "Inventário" }, { id: "personagem", rotulo: "Personagem" }, { id: "historia", rotulo: "História" },
];

export default function FichaDnd5e({ mesaId, donoUid, nomePadrao = "" }: { mesaId: string; donoUid: string; nomePadrao?: string }) {
  const { ficha: f, carregado, salvar } = useFichaPersonagem(mesaId, donoUid);
  const [aba, setAba] = useState<Aba>("combate");
  const [rolando, setRolando] = useState<{ t: Teste; seq: number } | null>(null);
  const [valorPv, setValorPv] = useState(1);
  const [novaMagia, setNovaMagia] = useState(0);

  if (!carregado) return <p className="py-10 text-center text-muted">Abrindo a ficha…</p>;

  const set = (p: Partial<FichaDnd>) => salvar({ ...f, ...p });
  const rolar = (t: Teste) => setRolando({ t, seq: (rolando?.seq ?? 0) + 1 });
  const prof = bonusProficiencia(f.nivel);

  const aplicarPv = (tipo: "dano" | "cura") => {
    if (tipo === "cura") return set({ pv: Math.min(f.pvMax, f.pv + valorPv), morteSucessos: 0, morteFalhas: 0 });
    const absorvido = Math.min(f.pvTemp, valorPv);
    set({ pvTemp: f.pvTemp - absorvido, pv: Math.max(0, f.pv - (valorPv - absorvido)) });
  };

  const setAtaque = (id: string, p: Partial<Ataque>) => set({ ataques: f.ataques.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const setItem = (id: string, p: Partial<Item>) => set({ itens: f.itens.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const setMagia = (id: string, p: Partial<Magia>) => set({ magias: f.magias.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  const setEspaco = (i: number, p: Partial<{ total: number; usados: number }>) =>
    set({ espacos: f.espacos.map((e, k) => (k === i ? { ...e, ...p } : e)) });

  const ciclo = (id: (typeof PERICIAS)[number]["id"]) => set({ pericias: { ...f.pericias, [id]: (((f.pericias[id] ?? 0) + 1) % 3) as NivelProf } });

  return (
    <div className="space-y-4">
      {/* Cabeçalho do personagem */}
      <header className="relative overflow-hidden rounded-2xl border-2 border-gold/50 bg-gradient-to-br from-card-2 via-card to-background p-5">
        <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 text-[9rem] leading-none text-gold/5">⚔</div>
        <div className="relative flex flex-wrap items-start gap-3">
          <input
            value={f.nome}
            onChange={(e) => set({ nome: e.target.value })}
            placeholder={nomePadrao || "Nome do personagem"}
            aria-label="Nome do personagem"
            className="min-w-0 flex-1 border-b border-gold/30 bg-transparent pb-1 font-display text-2xl font-bold tracking-wide focus:border-gold sm:text-3xl focus:outline-none"
          />
          <button
            onClick={() => set({ inspiracao: !f.inspiracao })}
            aria-pressed={f.inspiracao}
            title="Inspiração"
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${f.inspiracao ? "border-gold bg-gold/20 text-gold" : "border-border text-muted hover:text-foreground"}`}
          >
            <Star size={14} className={f.inspiracao ? "fill-gold" : ""} /> Inspiração
          </button>
          <button
            onClick={() => set(descansoLongo(f))}
            title="Recupera tudo: PV, espaços de magia, dados de vida e descansos curtos"
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-gold"
          >
            <BedDouble size={14} /> Descanso longo
          </button>
          <button
            onClick={() => { const havia = temDadoVida(f); set(descansoCurto(f)); if (havia) rolar(testeDadoVida(f)); }}
            disabled={!podeDescansoCurto(f)}
            title="Até 2 por descanso longo: gasta 1 dado de vida (cura) e restaura todos os espaços de magia"
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted"
          >
            <BedDouble size={14} /> Descanso curto ({f.descansosCurtos}/{MAX_DESCANSOS_CURTOS})
          </button>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {([["classe", "Classe"], ["subclasse", "Subclasse"], ["raca", "Raça"], ["antecedente", "Antecedente"], ["alinhamento", "Alinhamento"]] as const).map(([k, r]) => (
            <label key={k} className="text-[11px] uppercase tracking-wider text-muted">
              {r}
              <input value={f[k]} onChange={(e) => set({ [k]: e.target.value })} className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`} />
            </label>
          ))}
          <label className="text-[11px] uppercase tracking-wider text-muted">
            Nível
            <Num valor={f.nivel} min={1} onChange={(n) => set({ nivel: Math.min(20, Math.max(1, n)) })} className="mt-0.5" />
          </label>
          <label className="text-[11px] uppercase tracking-wider text-muted">
            XP
            <Num valor={f.xp} min={0} onChange={(n) => set({ xp: n })} className="mt-0.5" />
          </label>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[17rem_1fr]">
        {/* Coluna esquerda: atributos, salvaguardas, perícias */}
        <div className="space-y-4">
          <section className={cartao}>
            <h2 className={titulo}>Atributos</h2>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
              {ATRIBUTOS.map((a) => (
                <div key={a} className="rounded-xl border border-gold/30 bg-background/60 p-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{ATRIBUTO_NOME[a]}</p>
                  <button
                    onClick={() => rolar(testeAtributo(f, a))}
                    title={`Rolar teste de ${ATRIBUTO_NOME[a]}`}
                    className="my-1 font-display text-2xl font-bold text-gold transition-transform hover:scale-110"
                  >
                    {comSinal(modDe(f, a))}
                  </button>
                  <Num valor={f.atributos[a]} min={1} onChange={(n) => set({ atributos: { ...f.atributos, [a]: Math.min(30, n) } })} className="!py-0.5" />
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              Bônus de proficiência <strong className="text-gold">{comSinal(prof)}</strong>
            </p>
          </section>

          <section className={cartao}>
            <h2 className={titulo}>Salvaguardas</h2>
            <ul className="space-y-1">
              {ATRIBUTOS.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.salvaguardas[a]}
                    onChange={(e) => set({ salvaguardas: { ...f.salvaguardas, [a]: e.target.checked } })}
                    aria-label={`Proficiência em salvaguarda de ${ATRIBUTO_NOME[a]}`}
                  />
                  <span className="flex-1">{ATRIBUTO_NOME[a]}</span>
                  <button onClick={() => rolar(testeSalvaguarda(f, a))} className={botaoRolar}>{comSinal(bonusSalvaguarda(f, a))}</button>
                </li>
              ))}
            </ul>
          </section>

          <section className={cartao}>
            <h2 className={titulo}>Perícias</h2>
            <ul className="space-y-0.5">
              {PERICIAS.map((p) => {
                const n = f.pericias[p.id] ?? 0;
                return (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => ciclo(p.id)}
                      title="Alternar: sem proficiência, proficiente, especialista"
                      aria-label={`Proficiência em ${p.nome}`}
                      className={`h-4 w-4 shrink-0 rounded-full border ${n === 0 ? "border-border" : "border-gold"} ${n === 1 ? "bg-gold/70" : n === 2 ? "bg-gold shadow-[0_0_0_2px_var(--card),0_0_0_3px_var(--gold)]" : ""}`}
                    />
                    <span className="flex-1 truncate">
                      {p.nome} <span className="text-[10px] uppercase text-muted">{ABREV[p.atr]}</span>
                    </span>
                    <button onClick={() => rolar(testePericia(f, p.id))} className={botaoRolar}>{comSinal(bonusPericia(f, p.id))}</button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-muted">Círculo vazio: sem proficiência · cheio: proficiente · com anel: especialista.</p>
          </section>
        </div>

        {/* Coluna direita */}
        <div className="min-w-0 space-y-4">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`${cartao} text-center`}>
              <Shield size={16} className="mx-auto text-gold" />
              <p className="text-[10px] uppercase tracking-widest text-muted">Classe de armadura</p>
              <Num valor={f.ca} onChange={(n) => set({ ca: n })} className="mt-1 !text-xl font-bold" />
            </div>
            <div className={`${cartao} text-center`}>
              <Swords size={16} className="mx-auto text-gold" />
              <p className="text-[10px] uppercase tracking-widest text-muted">Iniciativa</p>
              <button onClick={() => rolar(testeIniciativa(f))} className={`${botaoRolar} mt-1 !text-xl`}>{comSinal(bonusIniciativa(f))}</button>
              <input
                type="number"
                value={f.bonusIniciativa}
                onChange={(e) => set({ bonusIniciativa: Number(e.target.value) || 0 })}
                title="Bônus extra de iniciativa"
                aria-label="Bônus extra de iniciativa"
                className={`${campo} mx-auto mt-1 !w-16 !py-0.5 text-center text-xs`}
              />
            </div>
            <div className={`${cartao} text-center`}>
              <Wind size={16} className="mx-auto text-gold" />
              <p className="text-[10px] uppercase tracking-widest text-muted">Deslocamento</p>
              <input value={f.deslocamento} onChange={(e) => set({ deslocamento: e.target.value })} className={`${campo} mt-1 text-center`} />
            </div>
            <div className={`${cartao} text-center`}>
              <p className="mt-[1.1rem] text-[10px] uppercase tracking-widest text-muted">Percepção passiva</p>
              <p className="mt-1 font-display text-2xl font-bold text-gold">{percepcaoPassiva(f)}</p>
            </div>
          </section>

          <section className={cartao}>
            <h2 className={titulo}><Heart size={14} /> Pontos de vida</h2>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <label className="text-[10px] uppercase tracking-widest text-muted">Atuais<Num valor={f.pv} onChange={(n) => set({ pv: Math.max(0, n) })} className="mt-1 !text-xl font-bold" /></label>
                  <label className="text-[10px] uppercase tracking-widest text-muted">Máximos<Num valor={f.pvMax} min={1} onChange={(n) => set({ pvMax: n })} className="mt-1 !text-xl font-bold" /></label>
                  <label className="text-[10px] uppercase tracking-widest text-muted">Temporários<Num valor={f.pvTemp} min={0} onChange={(n) => set({ pvTemp: n })} className="mt-1 !text-xl font-bold" /></label>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-danger to-ok transition-[width]"
                    style={{ width: `${Math.min(100, Math.max(0, (f.pv / Math.max(1, f.pvMax)) * 100))}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <button onClick={() => aplicarPv("dano")} className="rounded-lg border border-danger/50 px-3 py-1 text-danger hover:bg-danger/10"><Minus size={13} className="mr-1 inline" />Dano</button>
                  <Num valor={valorPv} min={1} onChange={setValorPv} className="!w-20" />
                  <button onClick={() => aplicarPv("cura")} className="rounded-lg border border-ok/50 px-3 py-1 text-ok hover:bg-ok/10"><Plus size={13} className="mr-1 inline" />Cura</button>
                  <span className="text-[11px] text-muted">O dano consome PV temporários primeiro.</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-24 text-xs text-muted">Dados de vida</span>
                  <input value={f.dadoVida} onChange={(e) => set({ dadoVida: e.target.value })} className={`${campo} !w-14 text-center`} aria-label="Tipo do dado de vida" />
                  <Num valor={f.dadosVidaTotal - f.dadosVidaUsados} min={0} onChange={(n) => set({ dadosVidaUsados: Math.max(0, f.dadosVidaTotal - n) })} className="!w-14" />
                  <span className="text-muted">/</span>
                  <Num valor={f.dadosVidaTotal} min={0} onChange={(n) => set({ dadosVidaTotal: n })} className="!w-14" />
                </div>
                <button
                  onClick={() => { set({ dadosVidaUsados: f.dadosVidaUsados + 1 }); rolar(testeDadoVida(f)); }}
                  disabled={!temDadoVida(f)}
                  title="Gasta mais um dado de vida e rola a cura (dado + Constituição)"
                  className="ml-[6.5rem] rounded-md border border-gold/40 px-2 py-0.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40"
                >
                  Gastar dado de vida
                </button>
                {([["morteSucessos", "Sucessos", "text-ok"], ["morteFalhas", "Falhas", "text-danger"]] as const).map(([k, r, cor]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-24 text-xs text-muted">Morte: {r}</span>
                    {[1, 2, 3].map((i) => (
                      <button
                        key={i}
                        onClick={() => set({ [k]: f[k] === i ? i - 1 : i })}
                        aria-label={`${r}: ${i}`}
                        aria-pressed={f[k] >= i}
                        className={`h-5 w-5 rounded-full border ${f[k] >= i ? `border-current bg-current ${cor}` : "border-border"}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <nav role="tablist" className="flex flex-wrap gap-1 border-b border-border">
            {ABAS.map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 font-display text-sm tracking-wide ${aba === a.id ? "border-gold text-gold" : "border-transparent text-muted hover:text-foreground"}`}
              >
                {a.rotulo}
              </button>
            ))}
          </nav>

          {aba === "combate" && (
            <section className={cartao}>
              <h2 className={titulo}><Swords size={14} /> Ataques</h2>
              {f.ataques.length === 0 && <p className="mb-3 text-sm text-muted">Nenhum ataque ainda. Adicione sua arma ou ataque natural.</p>}
              <ul className="space-y-3">
                {f.ataques.map((a) => {
                  const modDano = modDe(f, a.atr) + a.bonusDano;
                  return (
                    <li key={a.id} className="rounded-xl border border-border bg-background/50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input value={a.nome} onChange={(e) => setAtaque(a.id, { nome: e.target.value })} placeholder="Nome (Espada longa)" className={`${campo} min-w-40 flex-1`} />
                        <button onClick={() => rolar(testeAtaque(f, a))} className={botaoRolar} title="Rolar ataque">
                          Ataque {comSinal(modDe(f, a.atr) + (a.proficiente ? prof : 0) + a.bonusAtaque)}
                        </button>
                        <button onClick={() => rolar(testeDano(f, a))} className={botaoRolar} title="Rolar dano">
                          Dano {a.dano || "1d4"}{modDano !== 0 ? comSinal(modDano) : ""}
                        </button>
                        <button onClick={() => set({ ataques: f.ataques.filter((x) => x.id !== a.id) })} aria-label="Remover ataque" className="text-muted hover:text-danger"><Trash2 size={15} /></button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wider text-muted sm:grid-cols-6">
                        <label>
                          Atributo
                          <select value={a.atr} onChange={(e) => setAtaque(a.id, { atr: e.target.value as Atributo })} className={`${campo} mt-0.5`}>
                            {ATRIBUTOS.map((x) => <option key={x} value={x}>{ABREV[x]}</option>)}
                          </select>
                        </label>
                        <label className="flex items-end gap-1.5 pb-2 normal-case tracking-normal">
                          <input type="checkbox" checked={a.proficiente} onChange={(e) => setAtaque(a.id, { proficiente: e.target.checked })} /> Proficiente
                        </label>
                        <label>Bônus acerto<Num valor={a.bonusAtaque} onChange={(n) => setAtaque(a.id, { bonusAtaque: n })} className="mt-0.5" /></label>
                        <label>Dado de dano<input value={a.dano} onChange={(e) => setAtaque(a.id, { dano: e.target.value })} placeholder="1d8" className={`${campo} mt-0.5 text-center`} /></label>
                        <label>Bônus dano<Num valor={a.bonusDano} onChange={(n) => setAtaque(a.id, { bonusDano: n })} className="mt-0.5" /></label>
                        <label>Tipo<input value={a.tipoDano} onChange={(e) => setAtaque(a.id, { tipoDano: e.target.value })} placeholder="cortante" className={`${campo} mt-0.5`} /></label>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button
                onClick={() => set({ ataques: [...f.ataques, { id: uid(), nome: "", atr: "for", proficiente: true, bonusAtaque: 0, dano: "1d8", bonusDano: 0, tipoDano: "", notas: "" }] })}
                className="mt-3 text-sm text-accent-hover hover:underline"
              >
                + Adicionar ataque
              </button>
            </section>
          )}

          {aba === "magias" && (
            <section className="space-y-4">
              <div className={cartao}>
                <h2 className={titulo}>Conjuração</h2>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="text-[11px] uppercase tracking-wider text-muted">
                    Atributo
                    <select value={f.atrConjuracao} onChange={(e) => set({ atrConjuracao: e.target.value as Atributo | "" })} className={`${campo} mt-0.5 !w-40`}>
                      <option value="">Não conjura</option>
                      {ATRIBUTOS.map((a) => <option key={a} value={a}>{ATRIBUTO_NOME[a]}</option>)}
                    </select>
                  </label>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted">CD da magia</p>
                    <p className="font-display text-2xl font-bold text-gold">{f.atrConjuracao ? cdMagia(f) : "—"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Ataque de magia</p>
                    <p className="font-display text-2xl font-bold text-gold">{f.atrConjuracao ? comSinal(bonusAtaqueMagia(f)) : "—"}</p>
                  </div>
                  <label className="ml-auto text-[11px] uppercase tracking-wider text-muted">
                    Preencher espaços pelo nível
                    <select
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const t = espacosPorNivel(e.target.value as "completo" | "meio", f.nivel);
                        set({ espacos: f.espacos.map((s, i) => ({ total: t[i], usados: Math.min(s.usados, t[i]) })) });
                      }}
                      className={`${campo} mt-0.5`}
                    >
                      <option value="">Escolha…</option>
                      <option value="completo">Conjurador completo</option>
                      <option value="meio">Meio-conjurador</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className={cartao}>
                <h2 className={titulo}>Espaços de magia</h2>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                  {f.espacos.map((e, i) => (
                    <div key={i} className="rounded-xl border border-border bg-background/50 p-2 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-muted">{i + 1}º círculo</p>
                      <div className="my-1.5 flex min-h-5 flex-wrap justify-center gap-1">
                        {Array.from({ length: e.total }, (_, k) => (
                          <button
                            key={k}
                            onClick={() => setEspaco(i, { usados: k < e.usados ? k : k + 1 })}
                            aria-label={`Espaço ${k + 1} do ${i + 1}º círculo`}
                            aria-pressed={k < e.usados}
                            className={`h-4 w-4 rounded-full border border-accent ${k < e.usados ? "bg-transparent" : "bg-accent shadow-[0_0_6px_var(--accent)]"}`}
                          />
                        ))}
                      </div>
                      <Num valor={e.total} min={0} onChange={(n) => setEspaco(i, { total: Math.min(n, 9), usados: Math.min(e.usados, n) })} className="!py-0.5 !text-xs" />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">Clique num círculo para marcar o espaço como gasto. O número abaixo é o total.</p>
              </div>

              <div className={cartao}>
                <h2 className={titulo}>Truques e magias</h2>
                {f.magias.length === 0 && <p className="mb-3 text-sm text-muted">Nenhuma magia ainda.</p>}
                {Array.from({ length: 10 }, (_, nv) => nv).map((nv) => {
                  const lista = f.magias.filter((m) => m.nivel === nv);
                  if (!lista.length) return null;
                  return (
                    <div key={nv} className="mb-4">
                      <h3 className="mb-1 border-b border-gold/20 pb-1 font-display text-sm text-gold">{nv === 0 ? "Truques" : `${nv}º círculo`}</h3>
                      <ul className="space-y-2">
                        {lista.map((m) => (
                          <li key={m.id} className="rounded-xl border border-border bg-background/50 p-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              {nv > 0 && <input type="checkbox" checked={m.preparada} onChange={(e) => setMagia(m.id, { preparada: e.target.checked })} aria-label="Preparada" title="Preparada" />}
                              <input value={m.nome} onChange={(e) => setMagia(m.id, { nome: e.target.value })} placeholder="Nome da magia" className={`${campo} min-w-40 flex-1`} />
                              {m.tipo === "ataque" && <button onClick={() => rolar(testeAtaqueMagia(f, m))} className={botaoRolar}>Ataque {comSinal(bonusAtaqueMagia(f))}</button>}
                              {m.tipo === "salvaguarda" && <span className="text-xs text-muted">CD <strong className="text-gold">{cdMagia(f)}</strong> · {ATRIBUTO_NOME[m.salvaguarda]}</span>}
                              {m.dano.trim() && <button onClick={() => rolar(testeDanoMagia(m))} className={botaoRolar}>Dano {m.dano}</button>}
                              <button onClick={() => set({ magias: f.magias.filter((x) => x.id !== m.id) })} aria-label="Remover magia" className="text-muted hover:text-danger"><Trash2 size={15} /></button>
                            </div>
                            <details className="mt-2 text-sm">
                              <summary className="cursor-pointer text-xs text-muted hover:text-foreground">Detalhes e descrição</summary>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wider text-muted sm:grid-cols-4">
                                {([["escola", "Escola"], ["tempo", "Tempo de conjuração"], ["alcance", "Alcance"], ["componentes", "Componentes"], ["duracao", "Duração"]] as const).map(([k, r]) => (
                                  <label key={k}>{r}<input value={m[k]} onChange={(e) => setMagia(m.id, { [k]: e.target.value })} className={`${campo} mt-0.5 normal-case tracking-normal`} /></label>
                                ))}
                                <label>Círculo<Num valor={m.nivel} min={0} onChange={(n) => setMagia(m.id, { nivel: Math.min(9, n) })} className="mt-0.5" /></label>
                                <label>
                                  Rolagem
                                  <select value={m.tipo} onChange={(e) => setMagia(m.id, { tipo: e.target.value as Magia["tipo"] })} className={`${campo} mt-0.5`}>
                                    <option value="nenhum">Nenhuma</option>
                                    <option value="ataque">Ataque de magia</option>
                                    <option value="salvaguarda">Salvaguarda</option>
                                  </select>
                                </label>
                                {m.tipo === "salvaguarda" && (
                                  <label>
                                    Salvaguarda de
                                    <select value={m.salvaguarda} onChange={(e) => setMagia(m.id, { salvaguarda: e.target.value as Atributo })} className={`${campo} mt-0.5`}>
                                      {ATRIBUTOS.map((a) => <option key={a} value={a}>{ABREV[a]}</option>)}
                                    </select>
                                  </label>
                                )}
                                <label>Dano (ex.: 8d6)<input value={m.dano} onChange={(e) => setMagia(m.id, { dano: e.target.value })} className={`${campo} mt-0.5 normal-case tracking-normal`} /></label>
                              </div>
                              <textarea value={m.descricao} onChange={(e) => setMagia(m.id, { descricao: e.target.value })} rows={3} placeholder="Descrição da magia" className={`${campo} mt-2`} />
                            </details>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 text-sm">
                  <select value={novaMagia} onChange={(e) => setNovaMagia(Number(e.target.value))} className={`${campo} !w-36`} aria-label="Círculo da nova magia">
                    <option value={0}>Truque</option>
                    {Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>{i + 1}º círculo</option>)}
                  </select>
                  <button
                    onClick={() => set({ magias: [...f.magias, { id: uid(), nome: "", nivel: novaMagia, preparada: novaMagia === 0, escola: "", tempo: "1 ação", alcance: "", componentes: "", duracao: "", descricao: "", tipo: "nenhum", dano: "", salvaguarda: "des" }] })}
                    className="text-accent-hover hover:underline"
                  >
                    + Adicionar {novaMagia === 0 ? "truque" : "magia"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {aba === "tracos" && (
            <section className={`${cartao} space-y-4`}>
              <Texto rotulo="Características, traços de raça e classe, talentos" valor={f.tracos} onChange={(v) => set({ tracos: v })} linhas={10} />
              <Texto rotulo="Outras proficiências e idiomas" valor={f.proficienciasIdiomas} onChange={(v) => set({ proficienciasIdiomas: v })} linhas={5} />
            </section>
          )}

          {aba === "inventario" && (
            <section className={`${cartao} space-y-4`}>
              <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                {([["pc", "Cobre"], ["pp", "Prata"], ["pe", "Electro"], ["po", "Ouro"], ["pl", "Platina"]] as const).map(([k, r]) => (
                  <label key={k} className="text-[10px] uppercase tracking-widest text-muted">
                    {r} ({k.toUpperCase()})
                    <Num valor={f.moedas[k]} min={0} onChange={(n) => set({ moedas: { ...f.moedas, [k]: n } })} className="mt-1" />
                  </label>
                ))}
              </div>
              <div>
                <h2 className={titulo}>Equipamento e itens</h2>
                {f.itens.length === 0 && <p className="mb-3 text-sm text-muted">Nenhum item cadastrado.</p>}
                <ul className="space-y-2">
                  {f.itens.map((i) => (
                    <li key={i.id} className="rounded-xl border border-border bg-background/50 p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="checkbox" checked={i.equipado} onChange={(e) => setItem(i.id, { equipado: e.target.checked })} aria-label="Equipado" title="Equipado" />
                        <input value={i.nome} onChange={(e) => setItem(i.id, { nome: e.target.value })} placeholder="Nome do item" className={`${campo} min-w-40 flex-1`} />
                        <label className="flex items-center gap-1 text-xs text-muted">Qtd<Num valor={i.quantidade} min={0} onChange={(n) => setItem(i.id, { quantidade: n })} className="!w-16" /></label>
                        <label className="flex items-center gap-1 text-xs text-muted">Peso (kg)<Num valor={i.peso} min={0} onChange={(n) => setItem(i.id, { peso: n })} className="!w-20" /></label>
                        <button onClick={() => set({ itens: f.itens.filter((x) => x.id !== i.id) })} aria-label="Remover item" className="text-muted hover:text-danger"><Trash2 size={15} /></button>
                      </div>
                      <input value={i.descricao} onChange={(e) => setItem(i.id, { descricao: e.target.value })} placeholder="Descrição ou propriedades (opcional)" className={`${campo} mt-2`} />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <button onClick={() => set({ itens: [...f.itens, { id: uid(), nome: "", quantidade: 1, peso: 0, equipado: false, descricao: "" }] })} className="text-accent-hover hover:underline">+ Adicionar item</button>
                  <span className="text-xs text-muted">Peso total: <strong className="text-gold">{pesoTotal(f.itens)} kg</strong></span>
                </div>
              </div>
              <Texto rotulo="Anotações sobre o equipamento" valor={f.equipamento} onChange={(v) => set({ equipamento: v })} linhas={4} />
            </section>
          )}

          {aba === "historia" && <LivroHistoria paginas={f.livro} titulo={f.tituloLivro} nomePersonagem={f.nome || nomePadrao} onChange={(livro) => set({ livro })} onTitulo={(tituloLivro) => set({ tituloLivro })} />}

          {aba === "personagem" && (
            <section className={`${cartao} grid gap-4 sm:grid-cols-2`}>
              <Texto rotulo="Traços de personalidade" valor={f.personalidade} onChange={(v) => set({ personalidade: v })} />
              <Texto rotulo="Ideais" valor={f.ideais} onChange={(v) => set({ ideais: v })} />
              <Texto rotulo="Vínculos" valor={f.vinculos} onChange={(v) => set({ vinculos: v })} />
              <Texto rotulo="Defeitos" valor={f.defeitos} onChange={(v) => set({ defeitos: v })} />
              <Texto rotulo="Aparência" valor={f.aparencia} onChange={(v) => set({ aparencia: v })} />
              <div className="sm:col-span-2"><Texto rotulo="Anotações" valor={f.notas} onChange={(v) => set({ notas: v })} linhas={6} /></div>
            </section>
          )}
        </div>
      </div>

      {rolando && <PainelRolagem key={rolando.seq} teste={rolando.t} onFechar={() => setRolando(null)} aoAplicar={rolando.t.cura ? (n) => set(curar(f, n)) : undefined} />}
    </div>
  );
}
