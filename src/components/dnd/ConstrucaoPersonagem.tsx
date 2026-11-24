"use client";

import { useEffect, useState } from "react";
import { ATRIBUTOS, ATRIBUTO_NOME, PERICIAS, type Atributo, type FichaDnd } from "@/lib/dnd5e";
import { ajustarConjuracao } from "@/lib/regras/dnd5e/multiclasse";
import { dnd5e } from "@/lib/regras/dnd5e/sistema";
import { bloqueia, opcaoAtiva, type OpcoesMesa, type Papel } from "@/lib/regras/sistema";
import type { Build, Escolhas } from "@/lib/regras/dnd5e/build";
import type { Catalogo, EscolhaDef, EscolhaOpcao } from "@/lib/regras/dnd5e/catalogo";
import { derivar, validar, type FichaCalculada } from "@/lib/regras/dnd5e/derivar";
import { construirBuildDeFicha, fichaEfetiva } from "@/lib/regras/dnd5e/efetiva";
import { carregarMagias, type MagiaCat } from "@/lib/regras/dnd5e/magias";

const campo = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const rotulo = "block text-[11px] uppercase tracking-wider text-muted";

export const IDIOMAS = ["Anão", "Comum", "Élfico", "Gigante", "Gnômico", "Goblin", "Halfling", "Orc", "Abissal", "Celestial", "Dialeto Subterrâneo", "Dracônico", "Infernal", "Primordial", "Silvestre", "Subcomum"];
const PADRAO_ATRIBUTOS = [15, 14, 13, 12, 10, 8];

type Opcao = { id: string; nome: string };

/** Campos de uma decisão do jogador (n seletores, sem repetir valor). */
export function EscolhaCampos({ def, valores, onChange, cat, opcoesMesa, magias }: {
  def: EscolhaDef; valores: string[]; onChange: (v: string[]) => void; cat: Catalogo; opcoesMesa?: OpcoesMesa; magias: MagiaCat[];
}) {
  let lista: Opcao[] | null = null;
  switch (def.tipo) {
    case "atributo": lista = (def.opcoes ? def.opcoes.map(String) : [...ATRIBUTOS]).filter((a) => !def.excluir?.includes(a)).map((a) => ({ id: a, nome: ATRIBUTO_NOME[a as Atributo] })); break;
    case "pericia": lista = (def.opcoes?.map(String) ?? PERICIAS.map((p) => p.id as string)).map((id) => ({ id, nome: PERICIAS.find((p) => p.id === id)?.nome ?? id })); break;
    case "idioma": lista = IDIOMAS.map((n) => ({ id: n, nome: n })); break;
    case "ferramenta": lista = def.opcoes ? def.opcoes.map((o) => ({ id: String(o), nome: String(o) })) : null; break;
    case "talento": lista = opcaoAtiva(dnd5e, opcoesMesa, "talentos") ? cat.talentos().map((t) => ({ id: t.id, nome: t.nome })) : []; break;
    case "truque": lista = magias.filter((m) => m.nivel === 0 && (!def.lista || m.classes.includes(def.lista))).map((m) => ({ id: m.id, nome: m.nome })); break;
    case "opcao": lista = (def.opcoes as EscolhaOpcao[]).map((o) => ({ id: o.id, nome: o.nome })); break;
  }
  const set = (i: number, v: string) => {
    const novo = Array.from({ length: def.qtd }, (_, k) => valores[k] ?? "");
    novo[i] = v;
    onChange(novo.filter(Boolean));
  };
  return (
    <fieldset className="space-y-1">
      <legend className={rotulo}>{def.rotulo}{def.valor ? ` (+${def.valor})` : ""}</legend>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: def.qtd }, (_, i) => {
          const atual = valores[i] ?? "";
          const emUso = new Set(valores.filter((_, k) => k !== i));
          return lista ? (
            <select key={i} value={atual} onChange={(e) => set(i, e.target.value)} className={`${campo} !w-auto min-w-36`} aria-label={`${def.rotulo} ${i + 1}`}>
              <option value="">Escolha…</option>
              {lista.filter((o) => !emUso.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          ) : (
            <input key={i} value={atual} onChange={(e) => set(i, e.target.value)} placeholder="Digite" className={`${campo} !w-auto min-w-36`} aria-label={`${def.rotulo} ${i + 1}`} />
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Montagem do personagem pelo livro (raça, sub-raça, antecedente, classe, atributos, escolhas e talentos).
 * `ficha` é a ficha gravada (com `build`); as mudanças passam por `onSalvar`. O jogador é bloqueado pelas regras
 * da mesa; o mestre pode editar de qualquer forma.
 */
export default function ConstrucaoPersonagem({ ficha, cat, calc, opcoes, papel, onSalvar }: {
  ficha: FichaDnd; cat: Catalogo; calc: FichaCalculada | null; opcoes?: OpcoesMesa; papel: Papel; onSalvar: (f: FichaDnd) => void;
}) {
  const b = ficha.build;
  const [erro, setErro] = useState("");
  const [magias, setMagias] = useState<MagiaCat[]>([]);
  useEffect(() => { void carregarMagias().then(setMagias).catch(() => {}); }, []);

  if (!b || !calc) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted">Monte o personagem escolhendo raça, antecedente e classe: a ficha calcula atributos, proficiências, PV e características e mostra de onde vem cada número. Os números atuais são preservados na conversão.</p>
        <button
          onClick={() => {
            if (!window.confirm("Ativar a construção pelo livro? A ficha passa a calcular atributos, perícias, PV e deslocamento. Dá para desativar depois.")) return;
            onSalvar({ ...ficha, build: construirBuildDeFicha(ficha, cat, opcoes) });
          }}
          className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 font-semibold text-gold hover:bg-gold/25"
        >
          Ativar construção pelo livro
        </button>
      </div>
    );
  }

  /** Aplica uma mudança no build: o jogador só passa se as regras da mesa deixarem. */
  const mudar = (fn: (b: Build) => Build) => {
    const novo = fn(b);
    const tentativa: FichaDnd = { ...ficha, build: novo };
    const violacoes = validar(tentativa, cat, opcoes);
    if (bloqueia(papel, violacoes)) {
      setErro(violacoes.filter((v) => v.gravidade !== "aviso").map((v) => v.mensagem).join(" "));
      return;
    }
    setErro("");
    // classe conjuradora: ajusta o atributo de conjuração e os espaços de magia ao nível
    const ef = fichaEfetiva(tentativa, derivar(tentativa, cat, opcoes), cat);
    const mudouClasse = JSON.stringify(novo.classes.map((k) => [k.id, k.nivel, k.subclasse])) !== JSON.stringify(b.classes.map((k) => [k.id, k.nivel, k.subclasse]));
    const conj = mudouClasse ? ajustarConjuracao(ef, novo, cat) : { atrConjuracao: ef.atrConjuracao, espacos: ef.espacos };
    onSalvar({ ...tentativa, atrConjuracao: conj.atrConjuracao, espacos: conj.espacos });
  };

  const c0 = b.classes[0];
  const cl = c0 && cat.classe(c0.id);
  const raca = b.raca && cat.raca(b.raca.id);
  const talentosOk = opcaoAtiva(dnd5e, opcoes, "talentos");
  const avisos = validar(ficha, cat, opcoes);
  const escolhasDe = (tipo: "raca" | "antecedente"): Escolhas => (tipo === "raca" ? b.raca?.escolhas : b.antecedente?.escolhas) ?? {};

  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <label className={rotulo}>Raça
          <select value={b.raca?.id ?? ""} onChange={(e) => mudar((x) => ({ ...x, raca: e.target.value ? { id: e.target.value, sub: cat.raca(e.target.value)?.sub?.find((s) => !s.requer)?.id } : undefined }))} className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`}>
            <option value="">Escolha…</option>
            {cat.racas().map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        {raca?.sub && (
          <label className={rotulo}>Sub-raça
            <select value={b.raca?.sub ?? ""} onChange={(e) => mudar((x) => ({ ...x, raca: { ...x.raca!, sub: e.target.value || undefined, escolhas: undefined } }))} className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`}>
              {!raca.sub.some((s) => s.id === b.raca?.sub) && <option value="">Escolha…</option>}
              {raca.sub.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.requer && !opcaoAtiva(dnd5e, opcoes, s.requer) ? " (exige regra opcional)" : ""}</option>)}
            </select>
          </label>
        )}
        <label className={rotulo}>Antecedente
          <select value={b.antecedente?.id ?? ""} onChange={(e) => mudar((x) => ({ ...x, antecedente: e.target.value ? { id: e.target.value } : undefined }))} className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`}>
            <option value="">Escolha…</option>
            {cat.antecedentes().map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <label className={rotulo}>Classe
          <select value={c0?.id ?? ""} onChange={(e) => mudar((x) => ({ ...x, classes: e.target.value ? [{ id: e.target.value, nivel: x.classes[0]?.nivel ?? 1, escolhas: { pericias: [] } }, ...x.classes.slice(1)] : [] }))} className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`}>
            <option value="">Escolha…</option>
            {cat.classes().map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
          </select>
        </label>
        {cl?.subclasses && (
          <label className={rotulo}>{cl.subclasseRotulo ?? "Subclasse"}{cl.subclasseNivel ? ` (${cl.subclasseNivel}º nível)` : ""}
            <select value={c0.subclasse ?? ""} onChange={(e) => mudar((x) => ({ ...x, classes: x.classes.map((k, i) => (i === 0 ? { ...k, subclasse: e.target.value || undefined } : k)) }))} className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`}>
              <option value="">Nenhuma ainda</option>
              {cl.subclasses.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </label>
        )}
        <label className={rotulo}>Nível{b.classes.length > 1 ? " (1ª classe)" : ""}
          <input type="number" min={1} max={20} value={c0?.nivel ?? 1} onChange={(e) => mudar((x) => ({ ...x, classes: x.classes.map((k, i) => (i === 0 ? { ...k, nivel: Math.min(20, Math.max(1, Number(e.target.value) || 1)) } : k)) }))} className={`${campo} mt-0.5 text-center`} />
        </label>
      </div>

      {b.classes.length > 1 && (
        <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
          <p className={rotulo}>Multiclasse: níveis por classe (total {b.classes.reduce((t, k) => t + k.nivel, 0)})</p>
          <ul className="space-y-1.5">
            {b.classes.map((k, i) => {
              const kc = cat.classe(k.id);
              return (
                <li key={k.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-28 font-semibold">{kc?.nome ?? k.id} {k.nivel}</span>
                  {i > 0 && kc?.subclasses && kc.subclasseNivel && k.nivel >= kc.subclasseNivel && (
                    <select value={k.subclasse ?? ""} onChange={(e) => mudar((x) => ({ ...x, classes: x.classes.map((y, j) => (j === i ? { ...y, subclasse: e.target.value || undefined } : y)) }))} className={`${campo} !w-auto text-xs`} aria-label={`${kc.subclasseRotulo} de ${kc.nome}`}>
                      <option value="">{kc.subclasseRotulo}…</option>
                      {kc.subclasses.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  )}
                  {i > 0 && papel === "mestre" && (
                    <button onClick={() => { if (window.confirm(`Remover ${kc?.nome ?? k.id} do personagem? Os níveis dela somem e o histórico de PV é ajustado.`)) mudar((x) => ({ ...x, classes: x.classes.filter((_, j) => j !== i), historicoNiveis: (x.historicoNiveis ?? []).filter((p) => p.classe !== k.id) })); }} className="ml-auto text-xs text-muted hover:text-danger">remover (mestre)</button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">Novos níveis (nesta ou em outra classe) entram pelo assistente &quot;Subir de nível&quot;. Proficiências de multiclasse, PV e espaços de magia são calculados pelas regras do livro.</p>
        </div>
      )}

      <div>
        <p className={rotulo}>Atributos base (antes dos bônus de raça e talentos)</p>
        <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ATRIBUTOS.map((a) => (
            <label key={a} className="text-center text-[10px] uppercase tracking-widest text-muted">
              {ATRIBUTO_NOME[a]}
              <input type="number" min={1} max={30} value={b.atributosBase[a]} onChange={(e) => mudar((x) => ({ ...x, metodoAtributos: "manual", atributosBase: { ...x.atributosBase, [a]: Math.min(30, Math.max(1, Number(e.target.value) || 1)) } }))} className={`${campo} mt-0.5 text-center`} />
              <span className="text-gold">{calc.atributos[a].total}</span>
            </label>
          ))}
        </div>
        <button
          onClick={() => mudar((x) => ({ ...x, metodoAtributos: "padrao", atributosBase: { for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 } }))}
          className="mt-1 text-xs text-accent-hover hover:underline"
          title={`Distribuição padrão: ${PADRAO_ATRIBUTOS.join(", ")} (reordene como quiser)`}
        >
          Aplicar distribuição padrão ({PADRAO_ATRIBUTOS.join(", ")})
        </button>
      </div>

      {(raca || b.antecedente || cl) && (
        <div className="space-y-3 rounded-xl border border-border bg-background/40 p-3">
          <p className={rotulo}>Escolhas do livro</p>
          {[...(raca?.escolhas ?? []), ...(raca?.sub?.find((s) => s.id === b.raca?.sub)?.escolhas ?? [])].map((d) => (
            <EscolhaCampos key={`r-${d.id}`} def={d} valores={escolhasDe("raca")[d.id] ?? []} cat={cat} opcoesMesa={opcoes} magias={magias}
              onChange={(v) => mudar((x) => ({ ...x, raca: { ...x.raca!, escolhas: { ...x.raca!.escolhas, [d.id]: v } } }))} />
          ))}
          {(b.antecedente && cat.antecedente(b.antecedente.id)?.escolhas || []).map((d) => (
            <EscolhaCampos key={`a-${d.id}`} def={d} valores={escolhasDe("antecedente")[d.id] ?? []} cat={cat} opcoesMesa={opcoes} magias={magias}
              onChange={(v) => mudar((x) => ({ ...x, antecedente: { ...x.antecedente!, escolhas: { ...x.antecedente!.escolhas, [d.id]: v } } }))} />
          ))}
          {cl?.pericias && (
            <EscolhaCampos
              def={{ id: "pericias", rotulo: `Perícias de ${cl.nome}`, tipo: "pericia", qtd: cl.pericias.qtd, opcoes: cl.pericias.opcoes }}
              valores={c0.escolhas?.pericias ?? []} cat={cat} opcoesMesa={opcoes} magias={magias}
              onChange={(v) => mudar((x) => ({ ...x, classes: x.classes.map((k, i) => (i === 0 ? { ...k, escolhas: { ...k.escolhas, pericias: v } } : k)) }))}
            />
          )}
        </div>
      )}

      {talentosOk && (
        <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
          <p className={rotulo}>Talentos (regra opcional da mesa)</p>
          {(b.talentos ?? []).map((id) => {
            const t = cat.talento(id);
            return (
              <div key={id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <strong>{t?.nome ?? id}</strong>
                  {t?.prerequisito && <span className="text-xs text-muted">Pré-requisito: {t.prerequisito}</span>}
                  <button onClick={() => mudar((x) => ({ ...x, talentos: (x.talentos ?? []).filter((y) => y !== id) }))} className="ml-auto text-xs text-muted hover:text-danger">remover</button>
                </div>
                {t?.escolhas?.map((d) => (
                  <EscolhaCampos key={d.id} def={d} valores={b.escolhasTalentos?.[id]?.[d.id] ?? []} cat={cat} opcoesMesa={opcoes} magias={magias}
                    onChange={(v) => mudar((x) => ({ ...x, escolhasTalentos: { ...x.escolhasTalentos, [id]: { ...x.escolhasTalentos?.[id], [d.id]: v } } }))} />
                ))}
              </div>
            );
          })}
          <select value="" onChange={(e) => e.target.value && mudar((x) => ({ ...x, talentos: [...(x.talentos ?? []), e.target.value] }))} className={`${campo} !w-auto`} aria-label="Adicionar talento">
            <option value="">+ Adicionar talento…</option>
            {cat.talentos().filter((t) => !(b.talentos ?? []).includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
      )}

      {papel === "mestre" && (
        <details className="rounded-xl border border-border bg-background/40 p-3">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted">Ajustes do mestre (fora do livro)</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([["pv.max", "PV máximos"], ["ca", "CA"], ["iniciativa", "Iniciativa"], ["deslocamento", "Deslocamento (m)"], ...ATRIBUTOS.map((a) => [`atr.${a}`, ATRIBUTO_NOME[a]] as const)] as (readonly [string, string])[]).map(([alvo, nome]) => (
              <label key={alvo} className="text-[10px] uppercase tracking-widest text-muted">
                {nome} (±)
                <input type="number" value={b.ajustes?.[alvo]?.somar ?? 0}
                  onChange={(e) => mudar((x) => {
                    const v = Number(e.target.value) || 0;
                    const ajustes = { ...x.ajustes };
                    if (v) ajustes[alvo] = { somar: v, rotulo: "Ajuste do mestre" }; else delete ajustes[alvo];
                    return { ...x, ajustes };
                  })}
                  className={`${campo} mt-0.5 text-center`} />
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Ajustes ficam marcados como &quot;fora do livro&quot; nas explicações dos números.</p>
        </details>
      )}

      {erro && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-danger">{erro} Peça ao mestre para liberar essa regra nas configurações da mesa.</p>}
      {avisos.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {avisos.map((v) => <li key={v.id} className={v.gravidade === "aviso" ? "text-muted" : "text-gold"}>{v.gravidade === "aviso" ? "• " : "⚠ "}{v.mensagem}</li>)}
        </ul>
      )}

      <button
        onClick={() => {
          if (!window.confirm("Desativar a construção pelo livro? Os valores calculados agora viram números fixos da ficha.")) return;
          const ef = fichaEfetiva(ficha, calc, cat);
          const { build: _descartado, ...resto } = ef;
          void _descartado;
          onSalvar(resto as FichaDnd);
        }}
        className="text-xs text-muted hover:text-danger"
      >
        Desativar construção pelo livro
      </button>
    </div>
  );
}

const ROTULO_FONTE: Record<string, string> = { raca: "Raça", subraca: "Sub-raça", antecedente: "Antecedente", classe: "Classe", subclasse: "Subclasse", talento: "Talento" };

/** Características e proficiências agrupadas pela fonte (raça, classe, antecedente, talentos), com o texto do livro. */
export function CaracteristicasPorFonte({ calc }: { calc: FichaCalculada }) {
  const listas: [string, FichaCalculada["armas"]][] = [["Armaduras", calc.armaduras], ["Armas", calc.armas], ["Ferramentas", calc.ferramentas], ["Idiomas", calc.idiomas], ["Resistências", calc.resistencias]];
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        {listas.filter(([, l]) => l.length).map(([nome, l]) => (
          <p key={nome}><strong className="text-gold">{nome}:</strong> {l.map((i, k) => <span key={i.nome} title={`Fonte: ${i.fonte}`}>{k ? ", " : ""}{i.nome}</span>)}</p>
        ))}
      </div>
      {calc.fontes.filter((f) => f.tracos.length).map((f) => (
        <div key={`${f.tipo}-${f.id}`}>
          <h3 className="mb-1 border-b border-gold/20 pb-1 font-display text-sm text-gold">{ROTULO_FONTE[f.tipo]}: {f.nome}</h3>
          <ul className="space-y-1">
            {f.tracos.map((t) => (
              <li key={t.id}>
                <details>
                  <summary className="cursor-pointer font-semibold">{t.nome}</summary>
                  <p className="mt-1 whitespace-pre-line text-muted">{t.texto}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
