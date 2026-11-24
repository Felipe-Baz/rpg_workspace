"use client";

import { useEffect, useMemo, useState } from "react";
import { ATRIBUTOS, ATRIBUTO_NOME, definirClasse, type Atributo, type FichaDnd } from "@/lib/dnd5e";
import { rolar } from "@/lib/dados";
import { dnd5e } from "@/lib/regras/dnd5e/sistema";
import { bloqueia, opcaoAtiva, type OpcoesMesa, type Papel } from "@/lib/regras/sistema";
import type { Build } from "@/lib/regras/dnd5e/build";
import type { Catalogo } from "@/lib/regras/dnd5e/catalogo";
import { derivar, validar } from "@/lib/regras/dnd5e/derivar";
import { fichaEfetiva } from "@/lib/regras/dnd5e/efetiva";
import { carregarMagias, type MagiaCat } from "@/lib/regras/dnd5e/magias";
import { CUSTO_COMPRA, DISTRIBUICAO_PADRAO, ORCAMENTO_COMPRA, RIQUEZA_INICIAL, custoCompra, usaCadaValorUmaVez } from "@/lib/regras/dnd5e/progressao";
import { EscolhaCampos } from "./ConstrucaoPersonagem";
import { Moldura } from "./AssistenteNivel";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const secao = "rounded-xl border border-border bg-background/40 p-3";
const rotulo = "block text-[11px] uppercase tracking-wider text-muted";
const sinal = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

type Metodo = "padrao" | "compra" | "rolagem" | "manual";
const PASSOS = ["Raça", "Classe", "Antecedente", "Atributos", "Riqueza", "Revisão"] as const;
const VAZIOS: Record<Atributo, number> = { for: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 };

/**
 * Criação guiada de personagem de 1º nível: raça → classe → antecedente → atributos (padrão, compra de pontos, 4d6 ou
 * manual) → riqueza inicial → revisão com tudo calculado. Cada passo mostra o texto do livro e o efeito no resultado.
 * Substitui a construção atual da ficha (com confirmação).
 */
export default function AssistenteCriacao({ ficha, cat, opcoes, papel, onSalvar, onFechar }: {
  ficha: FichaDnd; cat: Catalogo; opcoes?: OpcoesMesa; papel: Papel; onSalvar: (f: FichaDnd) => void; onFechar: () => void;
}) {
  const [passo, setPasso] = useState(0);
  const [raca, setRaca] = useState<Build["raca"]>(undefined);
  const [classeId, setClasseId] = useState("");
  const [subclasse] = useState<string | undefined>(undefined);
  const [periciasClasse, setPericiasClasse] = useState<string[]>([]);
  const [antecedente, setAntecedente] = useState<Build["antecedente"]>(undefined);
  const [metodo, setMetodo] = useState<Metodo>("padrao");
  const [valores, setValores] = useState<Record<Atributo, number>>({ for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 });
  const [rolagens, setRolagens] = useState<{ total: number; dados: number[] }[]>([]);
  const [indices, setIndices] = useState<Partial<Record<Atributo, number>>>({});
  const [riqueza, setRiqueza] = useState<number | null>(null);
  const [nome, setNome] = useState(ficha.nome);
  const [erro, setErro] = useState("");
  const [magias, setMagias] = useState<MagiaCat[]>([]);
  useEffect(() => { void carregarMagias().then(setMagias).catch(() => {}); }, []);

  const talentosOk = opcaoAtiva(dnd5e, opcoes, "talentos");
  const racaCat = raca && cat.raca(raca.id);
  const classeCat = classeId ? cat.classe(classeId) : undefined;
  const antCat = antecedente && cat.antecedente(antecedente.id);

  const build: Build = useMemo(() => ({
    raca, antecedente,
    classes: classeId ? [{ id: classeId, nivel: 1, ...(subclasse ? { subclasse } : {}), escolhas: { pericias: periciasClasse } }] : [],
    atributosBase: valores, metodoAtributos: metodo,
  }), [raca, antecedente, classeId, subclasse, periciasClasse, valores, metodo]);
  const tentativa: FichaDnd = useMemo(() => ({ ...ficha, build }), [ficha, build]);
  const calc = useMemo(() => derivar(tentativa, cat, opcoes), [tentativa, cat, opcoes]);

  // atributos: valor de cada método
  const valoresRolados = rolagens.map((r) => r.total);
  const atribuidos = ATRIBUTOS.map((a) => indices[a]).filter((i): i is number => i !== undefined);
  const atributosOk = metodo === "padrao" ? usaCadaValorUmaVez(valores, DISTRIBUICAO_PADRAO)
    : metodo === "compra" ? (custoCompra(valores) ?? 99) <= ORCAMENTO_COMPRA
    : metodo === "rolagem" ? valoresRolados.length === 6 && atribuidos.length === 6 && new Set(atribuidos).size === 6
    : ATRIBUTOS.every((a) => valores[a] >= 3 && valores[a] <= 20);
  const gasto = custoCompra(valores);

  const escolhasPendentes = (calc.fontes.flatMap((f) => f.pendentes).length) + Math.max(0, (classeCat?.pericias?.qtd ?? 0) - periciasClasse.length);
  const podeAvancar = [!!raca && (!racaCat?.sub || !!raca.sub), !!classeCat && periciasClasse.length === (classeCat.pericias?.qtd ?? 0), !!antecedente, atributosOk, true, true][passo];

  const trocarMetodo = (m: Metodo) => {
    setMetodo(m);
    setIndices({});
    setValores(m === "padrao" ? { for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 } : m === "compra" ? { ...VAZIOS } : m === "rolagem" ? { ...VAZIOS } : { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 });
  };
  const rolarTudo = () => {
    const r = Array.from({ length: 6 }, () => { const x = rolar("4d6kh3"); return { total: x?.total ?? 10, dados: x?.grupos[0]?.dados ?? [] }; });
    setRolagens(r); setIndices({}); setValores({ ...VAZIOS });
  };
  const atribuir = (a: Atributo, i: number | undefined) => {
    setIndices((x) => ({ ...x, [a]: i }));
    setValores((v) => ({ ...v, [a]: i === undefined ? 8 : valoresRolados[i] }));
  };

  const concluir = () => {
    const viol = validar(tentativa, cat, opcoes);
    if (bloqueia(papel, viol)) { setErro(viol.filter((v) => v.gravidade !== "aviso").map((v) => v.mensagem).join(" ")); return; }
    if (!window.confirm("Aplicar este personagem? Raça, classe, antecedente, atributos, perícias e PV da ficha serão substituídos.")) return;
    const ef = fichaEfetiva(tentativa, calc, cat);
    const comClasse = ef.classe ? definirClasse(ef, ef.classe) : ef;
    onSalvar({
      ...tentativa, nome: nome || ficha.nome,
      atrConjuracao: comClasse.atrConjuracao, espacos: comClasse.espacos,
      pv: calc.pvMax.total, pvTemp: 0, morteSucessos: 0, morteFalhas: 0, dadosVidaUsados: 0, descansosCurtos: 0,
      xp: 0, recursos: {}, ativos: [], condicoes: [], exaustao: 0,
      moedas: riqueza ? { ...ficha.moedas, po: ficha.moedas.po + riqueza } : ficha.moedas,
    });
    onFechar();
  };

  const escolhasRaca = [...(racaCat?.escolhas ?? []), ...(racaCat?.sub?.find((s) => s.id === raca?.sub)?.escolhas ?? [])];
  const mudaEscolhasRaca = (id: string, v: string[]) => setRaca((r) => (r ? { ...r, escolhas: { ...r.escolhas, [id]: v } } : r));
  const mudaEscolhasAnt = (id: string, v: string[]) => setAntecedente((a) => (a ? { ...a, escolhas: { ...a.escolhas, [id]: v } } : a));

  return (
    <Moldura titulo="Criação de personagem" onFechar={onFechar}>
      <ol className="mb-3 flex flex-wrap gap-1 text-[11px]">
        {PASSOS.map((p, i) => (
          <li key={p}><button onClick={() => i <= passo && setPasso(i)} disabled={i > passo} className={`rounded-full border px-2.5 py-0.5 ${i === passo ? "border-gold bg-gold/20 font-semibold text-gold" : i < passo ? "border-gold/40 text-gold/80" : "border-border text-muted"}`}>{i + 1}. {p}</button></li>
        ))}
      </ol>

      <div className="space-y-3 text-sm">
        {passo === 0 && (
          <section className={secao}>
            <label className={rotulo}>Raça
              <select value={raca?.id ?? ""} onChange={(e) => { const r = cat.raca(e.target.value); setRaca(r ? { id: r.id, sub: r.sub?.find((s) => !s.requer)?.id } : undefined); }} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`}>
                <option value="">Escolha…</option>
                {cat.racas().map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </label>
            {racaCat?.sub && (
              <label className={`${rotulo} mt-2`}>Sub-raça
                <select value={raca?.sub ?? ""} onChange={(e) => setRaca((r) => (r ? { ...r, sub: e.target.value || undefined, escolhas: undefined } : r))} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`}>
                  {racaCat.sub.map((s) => <option key={s.id} value={s.id} disabled={!!s.requer && !opcaoAtiva(dnd5e, opcoes, s.requer) && papel !== "mestre"}>{s.nome}{s.requer && !opcaoAtiva(dnd5e, opcoes, s.requer) ? " (exige regra opcional)" : ""}</option>)}
                </select>
              </label>
            )}
            {racaCat && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted">{racaCat.tamanho}, deslocamento {String(racaCat.deslocamento).replace(".", ",")} m. Atributos: {ATRIBUTOS.map((a) => { const t = calc.atributos[a].total - valores[a]; return t ? `${ATRIBUTO_NOME[a]} ${sinal(t)}` : null; }).filter(Boolean).join(", ") || "à sua escolha"}.</p>
                {escolhasRaca.map((d) => <EscolhaCampos key={d.id} def={d} valores={raca?.escolhas?.[d.id] ?? []} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={(v) => mudaEscolhasRaca(d.id, v)} />)}
                <details><summary className="cursor-pointer text-xs text-muted">Traços raciais</summary>
                  <ul className="mt-1 space-y-1 text-xs">{[...(racaCat.tracos ?? []), ...(racaCat.sub?.find((s) => s.id === raca?.sub)?.tracos ?? [])].map((t) => <li key={t.id}><strong>{t.nome}.</strong> <span className="text-muted">{t.texto}</span></li>)}</ul>
                </details>
              </div>
            )}
          </section>
        )}

        {passo === 1 && (
          <section className={secao}>
            <label className={rotulo}>Classe
              <select value={classeId} onChange={(e) => { setClasseId(e.target.value); setPericiasClasse([]); }} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`}>
                <option value="">Escolha…</option>
                {cat.classes().map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            {classeCat && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted">Dado de vida d{classeCat.dadoVida} · Salvaguardas: {classeCat.salvaguardas.map((a) => ATRIBUTO_NOME[a as Atributo]).join(" e ")} · Armaduras: {classeCat.armaduras} · Armas: {classeCat.armas}</p>
                {classeCat.pericias && <EscolhaCampos def={{ id: "pericias", rotulo: `Perícias de ${classeCat.nome}`, tipo: "pericia", qtd: classeCat.pericias.qtd, opcoes: classeCat.pericias.opcoes }} valores={periciasClasse} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={setPericiasClasse} />}
                <details><summary className="cursor-pointer text-xs text-muted">Características do 1º nível</summary>
                  <ul className="mt-1 space-y-1 text-xs">{(classeCat.caracteristicas ?? []).filter((c) => (c.nivel ?? 1) <= 1).map((c) => <li key={c.id}><strong>{c.nome}.</strong> <span className="text-muted">{c.texto.slice(0, 280)}{c.texto.length > 280 ? "…" : ""}</span></li>)}</ul>
                </details>
                {classeCat.subclasseNivel === 1 && <p className="text-xs text-gold">{classeCat.subclasseRotulo} é escolhido já no 1º nível: faça isso na aba Personagem depois de concluir.</p>}
              </div>
            )}
          </section>
        )}

        {passo === 2 && (
          <section className={secao}>
            <label className={rotulo}>Antecedente
              <select value={antecedente?.id ?? ""} onChange={(e) => setAntecedente(e.target.value ? { id: e.target.value } : undefined)} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`}>
                <option value="">Escolha…</option>
                {cat.antecedentes().map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
            {antCat && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted">Perícias: {antCat.concede?.pericias?.map((p) => p).join(", ")}{antCat.concede?.ferramentas?.length ? ` · Ferramentas: ${antCat.concede.ferramentas.join(", ")}` : ""}</p>
                {(antCat.escolhas ?? []).map((d) => <EscolhaCampos key={d.id} def={d} valores={antecedente?.escolhas?.[d.id] ?? []} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={(v) => mudaEscolhasAnt(d.id, v)} />)}
                {antCat.caracteristica && <p className="text-xs"><strong>{antCat.caracteristica.nome}.</strong> <span className="text-muted">{antCat.caracteristica.texto.slice(0, 300)}…</span></p>}
                {antCat.equipamento && <p className="text-xs text-muted"><strong>Equipamento:</strong> {antCat.equipamento}</p>}
              </div>
            )}
          </section>
        )}

        {passo === 3 && (
          <section className={secao}>
            <div className="mb-2 flex flex-wrap gap-2">
              {([["padrao", "Distribuição padrão"], ["compra", "Compra de pontos"], ["rolagem", "Rolar 4d6"], ["manual", "Manual"]] as const).map(([m, r]) => (
                <button key={m} aria-pressed={metodo === m} onClick={() => trocarMetodo(m)} className={`rounded-full border px-3 py-1 text-xs ${metodo === m ? "border-gold bg-gold/20 font-semibold text-gold" : "border-border text-muted hover:text-foreground"}`}>{r}</button>
              ))}
            </div>
            {metodo === "padrao" && <p className="mb-2 text-xs text-muted">Atribua {DISTRIBUICAO_PADRAO.join(", ")} aos seis atributos, um valor em cada.</p>}
            {metodo === "compra" && <p className="mb-2 text-xs text-muted">27 pontos; de 8 a 15 (antes dos bônus raciais). Gasto: <strong className={(gasto ?? 99) > ORCAMENTO_COMPRA ? "text-danger" : "text-gold"}>{gasto ?? "—"}/{ORCAMENTO_COMPRA}</strong></p>}
            {metodo === "rolagem" && (
              <div className="mb-2 space-y-1 text-xs text-muted">
                <button onClick={rolarTudo} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-semibold text-gold hover:bg-gold/20">{rolagens.length ? "Rolar de novo" : "Rolar seis atributos (4d6, descarta o menor)"}</button>
                {rolagens.length > 0 && <p>Resultados: {rolagens.map((r, i) => <span key={i} className="mr-2 font-mono text-foreground" title={`dados ${r.dados.join(", ")}`}>{r.total}</span>)}— atribua cada um a um atributo.</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ATRIBUTOS.map((a) => (
                <div key={a} className="rounded-xl border border-gold/30 bg-background/60 p-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{ATRIBUTO_NOME[a]}</p>
                  {metodo === "padrao" && (
                    <select value={valores[a]} onChange={(e) => setValores((v) => ({ ...v, [a]: Number(e.target.value) }))} className={`${campo} mt-1 w-full text-center`} aria-label={ATRIBUTO_NOME[a]}>
                      {DISTRIBUICAO_PADRAO.map((n, i) => <option key={i} value={n}>{n}</option>)}
                    </select>
                  )}
                  {metodo === "compra" && (
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <button aria-label={`Diminuir ${ATRIBUTO_NOME[a]}`} disabled={valores[a] <= 8} onClick={() => setValores((v) => ({ ...v, [a]: v[a] - 1 }))} className="rounded border border-border px-2 disabled:opacity-40">−</button>
                      <strong className="w-6 text-lg">{valores[a]}</strong>
                      <button aria-label={`Aumentar ${ATRIBUTO_NOME[a]}`} disabled={valores[a] >= 15 || (gasto ?? 0) - CUSTO_COMPRA[valores[a]] + CUSTO_COMPRA[valores[a] + 1] > ORCAMENTO_COMPRA} onClick={() => setValores((v) => ({ ...v, [a]: v[a] + 1 }))} className="rounded border border-border px-2 disabled:opacity-40">+</button>
                    </div>
                  )}
                  {metodo === "rolagem" && (
                    <select value={indices[a] ?? ""} onChange={(e) => atribuir(a, e.target.value === "" ? undefined : Number(e.target.value))} className={`${campo} mt-1 w-full text-center`} aria-label={ATRIBUTO_NOME[a]} disabled={!rolagens.length}>
                      <option value="">—</option>
                      {rolagens.map((r, i) => <option key={i} value={i} disabled={Object.entries(indices).some(([k, v]) => v === i && k !== a)}>{r.total}</option>)}
                    </select>
                  )}
                  {metodo === "manual" && <input type="number" min={3} max={20} value={valores[a]} onChange={(e) => setValores((v) => ({ ...v, [a]: Number(e.target.value) || 3 }))} className={`${campo} mt-1 w-full text-center`} aria-label={ATRIBUTO_NOME[a]} />}
                  <p className="mt-1 text-xs text-muted">final <strong className="text-gold">{calc.atributos[a].total}</strong> ({sinal(calc.mods[a])})</p>
                </div>
              ))}
            </div>
            {classeCat && <p className="mt-2 text-xs text-muted">Dica do livro: coloque o valor mais alto no atributo principal da classe e o seguinte em Constituição.</p>}
          </section>
        )}

        {passo === 4 && (
          <section className={secao}>
            <p className="text-xs text-muted">Em vez do equipamento inicial da classe, você pode começar com ouro e comprar o que quiser no catálogo do inventário.</p>
            {classeCat && RIQUEZA_INICIAL[classeCat.id] ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span>Riqueza de {classeCat.nome}: {RIQUEZA_INICIAL[classeCat.id].dados}{RIQUEZA_INICIAL[classeCat.id].vezes > 1 ? ` × ${RIQUEZA_INICIAL[classeCat.id].vezes}` : ""} po</span>
                <button onClick={() => setRiqueza((rolar(RIQUEZA_INICIAL[classeCat.id].dados)?.total ?? 0) * RIQUEZA_INICIAL[classeCat.id].vezes)} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold hover:bg-gold/20">{riqueza === null ? "Rolar" : "Rolar de novo"}</button>
                {riqueza !== null && <strong className="text-gold">{riqueza} po</strong>}
                {riqueza !== null && <button onClick={() => setRiqueza(null)} className="text-xs text-muted hover:text-foreground">não usar</button>}
              </div>
            ) : <p className="mt-2 text-xs text-muted">Escolha uma classe no passo 2.</p>}
            <p className="mt-2 text-xs text-muted">Pule este passo se preferir o equipamento da classe: cadastre os itens no inventário depois.</p>
          </section>
        )}

        {passo === 5 && (
          <section className={secao}>
            <label className={rotulo}>Nome do personagem
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`} />
            </label>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              <div><dt className="text-muted">Raça</dt><dd className="font-semibold">{racaCat?.sub?.find((s) => s.id === raca?.sub)?.nome ?? racaCat?.nome}</dd></div>
              <div><dt className="text-muted">Classe</dt><dd className="font-semibold">{classeCat?.nome} 1</dd></div>
              <div><dt className="text-muted">Antecedente</dt><dd className="font-semibold">{antCat?.nome}</dd></div>
              <div><dt className="text-muted">PV</dt><dd className="font-semibold">{calc.pvMax.total}</dd></div>
              <div><dt className="text-muted">CA</dt><dd className="font-semibold">{calc.ca.total}</dd></div>
              <div><dt className="text-muted">Deslocamento</dt><dd className="font-semibold">{String(calc.deslocamento.total).replace(".", ",")} m</dd></div>
              <div className="col-span-full"><dt className="text-muted">Atributos</dt><dd className="font-semibold">{ATRIBUTOS.map((a) => `${ATRIBUTO_NOME[a].slice(0, 3)} ${calc.atributos[a].total} (${sinal(calc.mods[a])})`).join(" · ")}</dd></div>
              <div className="col-span-full"><dt className="text-muted">Perícias</dt><dd className="font-semibold">{Object.keys(calc.pericias).length ? Object.keys(calc.pericias).join(", ") : "—"}</dd></div>
            </dl>
            {escolhasPendentes > 0 && <p className="mt-2 text-xs text-gold">Ainda há {escolhasPendentes} escolha(s) pendente(s); volte aos passos anteriores ou termine depois na aba Personagem.</p>}
          </section>
        )}

        {erro && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-danger">{erro}</p>}
        <div className="flex justify-between gap-2">
          <button onClick={() => (passo === 0 ? onFechar() : setPasso(passo - 1))} className="rounded-lg border border-border px-3 py-1.5 text-muted hover:text-foreground">{passo === 0 ? "Cancelar" : "Voltar"}</button>
          {passo < PASSOS.length - 1
            ? <button onClick={() => setPasso(passo + 1)} disabled={!podeAvancar} className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 font-semibold text-gold hover:bg-gold/25 disabled:opacity-40">Próximo</button>
            : <button onClick={concluir} className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 font-semibold text-gold hover:bg-gold/25">Criar personagem</button>}
        </div>
        {talentosOk && passo === 0 && <p className="text-xs text-muted">Talentos estão ligados nesta mesa: o humano variante está disponível.</p>}
      </div>
    </Moldura>
  );
}


