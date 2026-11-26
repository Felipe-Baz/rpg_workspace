"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ATRIBUTOS, ATRIBUTO_NOME, limitesMagia, modificador, type Atributo, type FichaDnd } from "@/lib/dnd5e";
import { rolar } from "@/lib/dados";
import { dnd5e } from "@/lib/regras/dnd5e/sistema";
import { bloqueia, opcaoAtiva, type OpcoesMesa, type Papel } from "@/lib/regras/sistema";
import type { Escolhas } from "@/lib/regras/dnd5e/build";
import type { Catalogo } from "@/lib/regras/dnd5e/catalogo";
import { derivar, validar } from "@/lib/regras/dnd5e/derivar";
import { fichaEfetiva } from "@/lib/regras/dnd5e/efetiva";
import { carregarMagias, type MagiaCat } from "@/lib/regras/dnd5e/magias";
import { ajustarConjuracao, adicionarClasse, classesNovas, conferirRequisitos, PROF_MULTICLASSE, textoRequisito, lerRequisito } from "@/lib/regras/dnd5e/multiclasse";
import { incrementoValido, incrementosDisponiveis, incrementosUsados, resumoSubida, subirNivel, type EscolhasSubida } from "@/lib/regras/dnd5e/progressao";
import { BRUXO, NIVEL_PACTO, invocacoesConhecidas, invocacoesDaFicha, pactoDaFicha, truquesDaFicha } from "@/lib/regras/dnd5e/invocacoes";
import { EscolhaCampos } from "./ConstrucaoPersonagem";
import { SeletorInvocacoes, SeletorPacto } from "./InvocacoesMisticas";
import TextoLivro from "./TextoLivro";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const secao = "rounded-xl border border-border bg-background/40 p-3";
const titulo = "mb-2 font-display text-xs font-semibold uppercase tracking-[0.2em] text-gold";
const sinal = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

/**
 * Assistente de subida de nível: mostra o que o próximo nível traz (características, bônus de proficiência, magias),
 * pergunta o que depende de você (PV, subclasse, aumento de atributo ou talento) e aplica tudo ao `build`.
 */
export default function AssistenteNivel({ ficha, cat, opcoes, papel, onSalvar, onFechar }: {
  ficha: FichaDnd; cat: Catalogo; opcoes?: OpcoesMesa; papel: Papel; onSalvar: (f: FichaDnd) => void; onFechar: () => void;
}) {
  const b = ficha.build;
  // qual classe ganha o nível: uma que o personagem já tem ("0", "1"...) ou uma nova ("nova:mago", multiclasse)
  const [alvo, setAlvo] = useState("0");
  const [escNova, setEscNova] = useState<Escolhas>({});
  const novaId = alvo.startsWith("nova:") ? alvo.slice(5) : "";
  const indice = novaId ? (b?.classes.length ?? 0) : Number(alvo) || 0;
  const resumo = useMemo(() => (b ? resumoSubida(novaId ? { ...b, classes: [...b.classes, { id: novaId, nivel: 0 }] } : b, cat, indice) : null), [b, cat, novaId, indice]);
  const multiclasseOk = opcaoAtiva(dnd5e, opcoes, "multiclasse") || papel === "mestre";
  const calc = useMemo(() => derivar(ficha, cat, opcoes), [ficha, cat, opcoes]);
  const talentosOk = opcaoAtiva(dnd5e, opcoes, "talentos");

  const [pvModo, setPvModo] = useState<"medio" | "rolar">("medio");
  const [pvRolado, setPvRolado] = useState(0);
  const [subclasse, setSubclasse] = useState("");
  const [modoInc, setModoInc] = useState<"mais2" | "mais1x2" | "talento">("mais2");
  const [a1, setA1] = useState<Atributo>("for");
  const [a2, setA2] = useState<Atributo>("con");
  const [talento, setTalento] = useState("");
  const [escTalento, setEscTalento] = useState<Escolhas>({});
  // bruxo: invocações místicas e Dádiva do Pacto (partem do que a ficha já tem; no máximo uma troca por nível)
  const [invs, setInvs] = useState<string[]>(() => invocacoesDaFicha(ficha));
  const [pacto, setPacto] = useState<string>(() => pactoDaFicha(ficha) ?? "");
  const [erro, setErro] = useState("");
  const [magias, setMagias] = useState<MagiaCat[]>([]);
  useEffect(() => { void carregarMagias().then(setMagias).catch(() => {}); }, []);

  if (!b || !resumo) {
    return (
      <Moldura onFechar={onFechar}>
        <p className="text-sm">{!b ? "Ative a construção pelo livro (aba Personagem) para usar o assistente de nível." : "O personagem já está no nível máximo."}</p>
      </Moldura>
    );
  }

  const conMod = modificador(calc.atributos.con.total);
  const pvGanho = Math.max(1, (pvModo === "medio" ? resumo.pvMedio : pvRolado) + conMod);
  const totais = Object.fromEntries(ATRIBUTOS.map((a) => [a, calc.atributos[a].total])) as Record<Atributo, number>;
  const provisorio = novaId ? adicionarClasse(b, { id: novaId, pv: "medio" }) : subirNivel(b, { classe: indice, pv: "medio" });
  const sobraDireito = incrementosDisponiveis(provisorio, cat) - incrementosUsados(b);
  const requisitos = novaId ? conferirRequisitos([...b.classes.map((c) => c.id), novaId], cat, totais) : [];
  const requisitosFalhos = requisitos.filter((r) => !r.ok);
  const profNova = novaId ? PROF_MULTICLASSE[novaId] : undefined;
  const pedeIncremento = resumo.incremento || sobraDireito > 0;

  const incremento: EscolhasSubida["incremento"] | undefined = !pedeIncremento ? undefined
    : modoInc === "talento" ? (talento ? { talento } : undefined)
    : modoInc === "mais2" ? { atributos: { [a1]: 2 } }
    : { atributos: a1 === a2 ? {} : { [a1]: 1, [a2]: 1 } };
  const erroInc = pedeIncremento ? (incremento ? incrementoValido(incremento, totais) : "Escolha o aumento de atributo ou o talento.") : null;
  const faltaSubclasse = resumo.escolheSubclasse && !subclasse;
  const pvInvalido = pvModo === "rolar" && (pvRolado < 1 || pvRolado > resumo.dadoVida);

  const pvEscolhido = pvModo === "medio" ? "medio" : pvRolado;
  // o bruxo (já na classe) escolhe invocações a partir do 2º nível e o pacto no 3º
  const ehBruxo = !novaId && b.classes[indice]?.id === BRUXO;
  const pedeInvocacoes = ehBruxo && resumo.para >= 2;
  const pedePacto = ehBruxo && resumo.para >= NIVEL_PACTO && !pactoDaFicha(ficha);
  const limiteInv = invocacoesConhecidas(resumo.para);
  const antesInv = invocacoesDaFicha(ficha);
  const trocas = antesInv.filter((id) => !invs.includes(id)).length;
  const novoBuild = () => novaId
    ? adicionarClasse(b, { id: novaId, pv: pvEscolhido, subclasse: subclasse || undefined, escolhas: escNova })
    : subirNivel(b, {
      classe: indice, pv: pvEscolhido, incremento: pedeIncremento ? incremento : undefined, subclasse: subclasse || undefined, escolhasTalento: talento ? escTalento : undefined,
      ...(pedeInvocacoes ? { invocacoes: invs } : {}), ...(pedePacto && pacto ? { pacto } : {}),
    });

  /** Ficha como ficaria no próximo nível (para mostrar o efeito nas magias e nos PV). */
  const depois = (() => {
    const t: FichaDnd = { ...ficha, build: novoBuild() };
    const ef = fichaEfetiva(t, derivar(t, cat, opcoes), cat);
    return { t, ef: { ...ef, ...ajustarConjuracao(ef, t.build!, cat) }, calc: derivar(t, cat, opcoes) };
  })();
  const antes = fichaEfetiva(ficha, calc, cat);
  const lAntes = limitesMagia(antes), lDepois = limitesMagia(depois.ef);

  const confirmar = () => {
    if (novaId && requisitosFalhos.length && papel !== "mestre") { setErro(`Multiclasse: ${requisitosFalhos.map((r) => `${r.nome} pede ${textoRequisito(lerRequisito(r.requisito))}`).join("; ")}.`); return; }
    if (pedeInvocacoes && trocas > 1 && papel !== "mestre") { setErro("Ao subir de nível você pode trocar no máximo uma invocação por outra."); return; }
    if (pedeInvocacoes && invs.length > limiteInv) { setErro(`Neste nível o bruxo conhece ${limiteInv} invocações.`); return; }
    if (faltaSubclasse || pvInvalido || erroInc) { setErro(erroInc || (faltaSubclasse ? "Escolha a subclasse." : "Informe um PV válido.")); return; }
    const viol = validar(depois.t, cat, opcoes);
    if (bloqueia(papel, viol)) { setErro(viol.filter((v) => v.gravidade !== "aviso").map((v) => v.mensagem).join(" ")); return; }
    const ganho = depois.calc.pvMax.total - calc.pvMax.total;
    onSalvar({ ...depois.t, atrConjuracao: depois.ef.atrConjuracao, espacos: depois.ef.espacos, pv: Math.min(depois.calc.pvMax.total, ficha.pv + Math.max(0, ganho)) });
    onFechar();
  };

  const novaSub = resumo.classe.subclasses ?? [];
  const tal = talento ? cat.talento(talento) : undefined;

  return (
    <Moldura onFechar={onFechar} titulo={`${resumo.classe.nome}: nível ${resumo.de} → ${resumo.para}`}>
      <div className="space-y-3 text-sm">
        {(b.classes.length > 1 || multiclasseOk) && (
          <section className={secao}>
            <h3 className={titulo}>Classe do nível</h3>
            <select value={alvo} onChange={(e) => { setAlvo(e.target.value); setSubclasse(""); setErro(""); setEscNova({}); }} className={`${campo} w-full`} aria-label="Classe que ganha o nível">
              {b.classes.map((c, i) => <option key={c.id} value={String(i)} disabled={c.nivel >= 20}>{cat.classe(c.id)?.nome ?? c.id} (nível {c.nivel} → {c.nivel + 1})</option>)}
              {multiclasseOk && classesNovas(b, cat).length > 0 && <optgroup label="Nova classe (multiclasse)">
                {classesNovas(b, cat).map((c) => <option key={c.id} value={`nova:${c.id}`}>{c.nome} (nível 1)</option>)}
              </optgroup>}
            </select>
            {novaId && (
              <div className="mt-2 space-y-2 text-xs">
                <ul className="space-y-0.5">
                  {requisitos.map((r) => <li key={r.classe} className={r.ok ? "text-muted" : "text-danger"}>{r.ok ? "✓" : "✗"} {r.nome}: {textoRequisito(lerRequisito(r.requisito))}</li>)}
                </ul>
                {requisitosFalhos.length > 0 && <p className="text-gold">{papel === "mestre" ? "Você, como mestre, pode liberar mesmo assim." : "Os atributos não atendem aos pré-requisitos: aumente-os ou peça ao mestre."}</p>}
                <p className="text-muted">Ao entrar na classe você ganha só as proficiências reduzidas da tabela de multiclasse e os PV como nível acima do 1º (sem equipamento inicial).</p>
                {profNova?.pericia && <EscolhaCampos def={{ id: "pericias", rotulo: "Perícia da nova classe", tipo: "pericia", qtd: 1, opcoes: profNova.pericia === "classe" ? resumo.classe.pericias?.opcoes : undefined }} valores={escNova.pericias ?? []} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={(v) => setEscNova({ ...escNova, pericias: v })} />}
                {profNova?.instrumento && <EscolhaCampos def={{ id: "ferramentas", rotulo: "Instrumento musical", tipo: "ferramenta", qtd: 1 }} valores={escNova.ferramentas ?? []} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={(v) => setEscNova({ ...escNova, ferramentas: v })} />}
              </div>
            )}
          </section>
        )}
        <section className={secao}>
          <h3 className={titulo}>O que o nível traz</h3>
          <p className="text-xs text-muted">Bônus de proficiência {sinal(resumo.proficiencia.antes)}{resumo.proficiencia.depois !== resumo.proficiencia.antes ? <> → <strong className="text-gold">{sinal(resumo.proficiencia.depois)}</strong></> : " (igual)"} · Dado de vida d{resumo.dadoVida}</p>
          {resumo.caracteristicas.length === 0 ? <p className="mt-1 text-xs text-muted">Nenhuma característica nova neste nível.</p> : (
            <ul className="mt-1 space-y-1">
              {resumo.caracteristicas.map((c, k) => (
                <li key={`${c.nome}-${k}`}><details><summary className="cursor-pointer font-semibold">{c.nome}</summary>{c.texto && <TextoLivro texto={c.texto} className="mt-1" />}</details></li>
              ))}
            </ul>
          )}
        </section>

        <section className={secao}>
          <h3 className={titulo}>Pontos de vida</h3>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1"><input type="radio" checked={pvModo === "medio"} onChange={() => setPvModo("medio")} /> Média ({resumo.pvMedio})</label>
            <label className="flex items-center gap-1"><input type="radio" checked={pvModo === "rolar"} onChange={() => setPvModo("rolar")} /> Rolar d{resumo.dadoVida}</label>
            {pvModo === "rolar" && (
              <>
                <input type="number" min={1} max={resumo.dadoVida} value={pvRolado || ""} onChange={(e) => setPvRolado(Number(e.target.value) || 0)} aria-label="Resultado do dado de vida" placeholder="dado" className={`${campo} !w-20 text-center`} />
                <button onClick={() => setPvRolado(rolar(`1d${resumo.dadoVida}`)?.total ?? 0)} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold hover:bg-gold/20">Rolar no site</button>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">Ganho: {pvModo === "rolar" && !pvRolado ? "—" : `${pvGanho} PV`} (dado + Constituição {sinal(conMod)}, mínimo 1). PV máximos {calc.pvMax.total} → <strong className="text-gold">{depois.calc.pvMax.total}</strong>.</p>
        </section>

        {resumo.escolheSubclasse && (
          <section className={secao}>
            <h3 className={titulo}>{resumo.subclasseRotulo ?? "Subclasse"}</h3>
            <select value={subclasse} onChange={(e) => setSubclasse(e.target.value)} className={`${campo} w-full`} aria-label="Subclasse">
              <option value="">Escolha…</option>
              {novaSub.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            {subclasse && <TextoLivro texto={novaSub.find((s) => s.id === subclasse)?.caracteristicas[0]?.texto ?? ""} className="mt-1" />}
          </section>
        )}

        {pedePacto && (
          <section className={secao}>
            <h3 className={titulo}>Dádiva do Pacto</h3>
            <SeletorPacto valor={pacto} onChange={setPacto} />
            {!pacto && <p className="mt-1 text-xs text-muted">Pode ficar para depois (a ficha avisa que falta), mas várias invocações dependem do pacto.</p>}
          </section>
        )}

        {pedeInvocacoes && (
          <section className={secao}>
            <h3 className={titulo}>Invocações Místicas</h3>
            <SeletorInvocacoes
              cat={cat} selecionadas={invs} limite={limiteInv} liberado={papel === "mestre"}
              ctx={{ nivelBruxo: resumo.para, pacto: pacto || pactoDaFicha(ficha), truques: truquesDaFicha(ficha) }}
              onChange={setInvs}
            />
            <p className="mt-1 text-xs text-muted">
              {invs.length < limiteInv ? `Faltam ${limiteInv - invs.length}: dá para completar depois na aba Traços. ` : ""}
              {antesInv.length ? `Trocas neste nível: ${trocas}/1 (o livro permite trocar uma invocação por outra ao subir de nível).` : ""}
            </p>
          </section>
        )}

        {pedeIncremento && (
          <section className={secao}>
            <h3 className={titulo}>Aumento de atributo{talentosOk ? " ou talento" : ""}</h3>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1"><input type="radio" checked={modoInc === "mais2"} onChange={() => setModoInc("mais2")} /> +2 em um</label>
              <label className="flex items-center gap-1"><input type="radio" checked={modoInc === "mais1x2"} onChange={() => setModoInc("mais1x2")} /> +1 em dois</label>
              {talentosOk && <label className="flex items-center gap-1"><input type="radio" checked={modoInc === "talento"} onChange={() => setModoInc("talento")} /> Talento</label>}
            </div>
            {modoInc !== "talento" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {([a1, ...(modoInc === "mais1x2" ? [a2] : [])] as Atributo[]).map((v, i) => (
                  <select key={i} value={v} onChange={(e) => (i === 0 ? setA1 : setA2)(e.target.value as Atributo)} className={`${campo} !w-auto`} aria-label={`Atributo ${i + 1}`}>
                    {ATRIBUTOS.map((a) => <option key={a} value={a}>{ATRIBUTO_NOME[a]} ({totais[a]})</option>)}
                  </select>
                ))}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <select value={talento} onChange={(e) => { setTalento(e.target.value); setEscTalento({}); }} className={`${campo} w-full`} aria-label="Talento">
                  <option value="">Escolha um talento…</option>
                  {cat.talentos().map((t) => <option key={t.id} value={t.id}>{t.nome}{t.prerequisito ? ` (${t.prerequisito})` : ""}</option>)}
                </select>
                {tal?.escolhas?.map((d) => <EscolhaCampos key={d.id} def={d} valores={escTalento[d.id] ?? []} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={(v) => setEscTalento({ ...escTalento, [d.id]: v })} />)}
                {tal?.texto && <TextoLivro texto={tal.texto} />}
              </div>
            )}
            {erroInc && <p className="mt-1 text-xs text-gold">{erroInc}</p>}
          </section>
        )}

        {(lAntes || lDepois) && (
          <section className={secao}>
            <h3 className={titulo}>Magias</h3>
            {lDepois ? (
              <ul className="space-y-0.5 text-xs">
                <li>Truques ativos: {lAntes?.truques ?? 0} → <strong className="text-gold">{lDepois.truques}</strong></li>
                <li>Magias ativas (1º círculo ou mais): {lAntes?.magias ?? 0} → <strong className="text-gold">{lDepois.magias}</strong></li>
                <li>Espaços: {antes.espacos.map((e, i) => (e.total ? `${i + 1}º ${e.total}` : null)).filter(Boolean).join(", ") || "nenhum"} → <strong className="text-gold">{depois.ef.espacos.map((e, i) => (e.total ? `${i + 1}º ${e.total}` : null)).filter(Boolean).join(", ") || "nenhum"}</strong></li>
              </ul>
            ) : <p className="text-xs text-muted">Classe sem conjuração.</p>}
            <p className="mt-1 text-xs text-muted">Depois de subir, use o compêndio para aprender magias e a troca de magias para ajustar as ativas.</p>
          </section>
        )}

        {erro && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-danger">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onFechar} className="rounded-lg border border-border px-3 py-1.5 text-muted hover:text-foreground">Cancelar</button>
          <button onClick={confirmar} className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 font-semibold text-gold hover:bg-gold/25">Subir para o nível {resumo.para}</button>
        </div>
      </div>
    </Moldura>
  );
}

export function Moldura({ titulo: t, onFechar, children }: { titulo?: string; onFechar: () => void; children: React.ReactNode }) {
  // o assistente é uma página no lugar da ficha, dentro do layout do site (não um popup nem um portal)
  return (
    <section className="ficha-rpg mx-auto w-full max-w-3xl rounded-2xl border-2 border-gold/50 bg-card p-5 shadow-xl" aria-label={t ?? "Assistente"}>
      <header className="mb-4 flex items-center gap-3 border-b border-gold/30 pb-3">
        <h2 className="font-display text-xl font-bold text-gold">{t ?? "Assistente"}</h2>
        <button onClick={onFechar} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"><X className="h-4 w-4" aria-hidden /> Sair do assistente</button>
      </header>
      {children}
    </section>
  );
}
