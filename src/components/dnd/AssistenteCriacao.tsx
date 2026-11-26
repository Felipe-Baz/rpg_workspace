"use client";

import { useEffect, useMemo, useState } from "react";
import { ATRIBUTOS, ATRIBUTO_NOME, PERICIAS, definirClasse, limitesMagia, modificador, type Atributo, type FichaDnd, type Item } from "@/lib/dnd5e";
import { uid } from "@/lib/mesas";
import { rolar } from "@/lib/dados";
import { dnd5e } from "@/lib/regras/dnd5e/sistema";
import { bloqueia, opcaoAtiva, type OpcoesMesa, type Papel } from "@/lib/regras/sistema";
import type { Build } from "@/lib/regras/dnd5e/build";
import type { Catalogo } from "@/lib/regras/dnd5e/catalogo";
import { derivar, validar } from "@/lib/regras/dnd5e/derivar";
import { fichaEfetiva } from "@/lib/regras/dnd5e/efetiva";
import { carregarMagias, magiaParaFicha, type MagiaCat } from "@/lib/regras/dnd5e/magias";
import { CUSTO_COMPRA, DISTRIBUICAO_PADRAO, ORCAMENTO_COMPRA, RIQUEZA_INICIAL, custoCompra, pvMedioDoDado, usaCadaValorUmaVez } from "@/lib/regras/dnd5e/progressao";
import { EQUIPAMENTO_INICIAL, equipamentoPendente, itensDaOpcao, itensDoSeletor, chaveEscolha, ouroDoAntecedente } from "@/lib/regras/dnd5e/equipamentoInicial";
import { emOuro, pagar, totalEmCobre } from "@/lib/regras/dnd5e/equipamento";
import { EscolhaCampos } from "./ConstrucaoPersonagem";
import { Moldura } from "./AssistenteNivel";
import TextoLivro from "./TextoLivro";
import CatalogoEquipamento, { itensParaAdicionar } from "./CatalogoEquipamento";
import CompendioMagias from "./CompendioMagias";
import { LISTA_EXPANDIDA } from "@/lib/regras/dnd5e/listaExpandida";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const secao = "rounded-xl border border-border bg-background/40 p-3";
const rotulo = "block text-[11px] uppercase tracking-wider text-muted";
const sinal = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

type Metodo = "padrao" | "compra" | "rolagem" | "manual";
type ModoVida = "maximo" | "media" | "rolar";
type ModoEquip = "classe" | "compra";
type Passo = "Raça" | "Classe" | "Antecedente" | "Atributos" | "Vida" | "Magias" | "Equipamento" | "Revisão";
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nomePericia = (id: string) => PERICIAS.find((p) => p.id === id)?.nome ?? id;
const nomeItem = (i: Item) => `${i.quantidade > 1 ? `${i.quantidade}× ` : ""}${i.nome}`;
const VAZIOS: Record<Atributo, number> = { for: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 };

/** Equipamento inicial: veste a armadura e o escudo e empunha até duas armas, para a CA e os ataques já saírem prontos. */
function equiparInicial(itens: Item[], cat: Catalogo): Item[] {
  let armadura = false, escudo = false, armas = 0;
  return itens.map((i) => {
    const c = i.catalogoId ? cat.item(i.catalogoId) : undefined;
    if (c?.tipo === "armadura" && !armadura) { armadura = true; return { ...i, equipado: true }; }
    if (c?.tipo === "escudo" && !escudo) { escudo = true; return { ...i, equipado: true }; }
    if (c?.tipo === "arma" && armas < 2) { armas++; return { ...i, equipado: true }; }
    return i;
  });
}

/**
 * Criação guiada de personagem de 1º nível: raça → classe → antecedente → atributos (padrão, compra de pontos, 4d6 ou
 * manual) → vida (máximo, média ou rolagem) → equipamento (opções A/B da classe ou compra com a riqueza inicial) →
 * revisão com tudo calculado. Cada passo mostra o texto do livro e o efeito no resultado.
 * Substitui a construção atual da ficha (com confirmação).
 */
export default function AssistenteCriacao({ ficha, cat, opcoes, papel, onSalvar, onFechar }: {
  ficha: FichaDnd; cat: Catalogo; opcoes?: OpcoesMesa; papel: Papel; onSalvar: (f: FichaDnd) => void; onFechar: () => void;
}) {
  const [passo, setPasso] = useState(0);
  const [raca, setRaca] = useState<Build["raca"]>(undefined);
  const [classeId, setClasseId] = useState("");
  const [subclasse, setSubclasse] = useState<string | undefined>(undefined);
  const [periciasClasse, setPericiasClasse] = useState<string[]>([]);
  const [antecedente, setAntecedente] = useState<Build["antecedente"]>(undefined);
  const [metodo, setMetodo] = useState<Metodo>("padrao");
  const [valores, setValores] = useState<Record<Atributo, number>>({ for: 15, des: 14, con: 13, int: 12, sab: 10, car: 8 });
  const [rolagens, setRolagens] = useState<{ total: number; dados: number[] }[]>([]);
  const [indices, setIndices] = useState<Partial<Record<Atributo, number>>>({});
  const [riqueza, setRiqueza] = useState<number | null>(null);
  const [substitutas, setSubstitutas] = useState<string[]>([]);
  const [modoVida, setModoVida] = useState<ModoVida>("maximo");
  const [dadoVidaRolado, setDadoVidaRolado] = useState<number | null>(null);
  const [modoEquip, setModoEquip] = useState<ModoEquip>("classe");
  const [opcaoEq, setOpcaoEq] = useState<Record<number, number>>({});
  const [escolhasEq, setEscolhasEq] = useState<Record<string, string>>({});
  const [compras, setCompras] = useState<{ itens: Item[]; custo: number }[]>([]);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [compraConfirmada, setCompraConfirmada] = useState(false);
  const [nome, setNome] = useState(ficha.nome);
  const [erro, setErro] = useState("");
  const [magias, setMagias] = useState<MagiaCat[]>([]);
  // magias escolhidas no assistente (truques e 1º círculo) e o compêndio aberto para escolhê-las
  const [escolhidas, setEscolhidas] = useState<MagiaCat[]>([]);
  const [compendioAberto, setCompendioAberto] = useState(false);
  useEffect(() => { void carregarMagias().then(setMagias).catch(() => {}); }, []);

  const talentosOk = opcaoAtiva(dnd5e, opcoes, "talentos");
  const racaCat = raca && cat.raca(raca.id);
  const classeCat = classeId ? cat.classe(classeId) : undefined;
  const antCat = antecedente && cat.antecedente(antecedente.id);

  const dadoVida = classeCat?.dadoVida ?? 8;
  const buildBase: Build = useMemo(() => ({
    raca, antecedente,
    classes: classeId ? [{ id: classeId, nivel: 1, ...(subclasse ? { subclasse } : {}), escolhas: { pericias: periciasClasse } }] : [],
    atributosBase: valores, metodoAtributos: metodo,
    ...(modoVida === "media" ? { pvNivel1: pvMedioDoDado(cat.classe(classeId)?.dadoVida ?? 8) } : modoVida === "rolar" && dadoVidaRolado !== null ? { pvNivel1: dadoVidaRolado } : {}),
  }), [raca, antecedente, classeId, subclasse, periciasClasse, valores, metodo, modoVida, dadoVidaRolado, cat]);

  // perícias que raça e antecedente já dão (a classe não deve repeti-las) e as que se repetem entre as fontes: o livro
  // manda trocar a repetida por outra à escolha
  const semClasse = useMemo(() => derivar({ ...ficha, build: { ...buildBase, classes: buildBase.classes.map((c) => ({ ...c, escolhas: { pericias: [] } })) } }, cat, opcoes), [ficha, buildBase, cat, opcoes]);
  const semExtras = useMemo(() => derivar({ ...ficha, build: buildBase }, cat, opcoes), [ficha, buildBase, cat, opcoes]);
  const jaTem = useMemo(() => new Set(Object.keys(semExtras.pericias)), [semExtras]);
  const repetidas = Object.values(semExtras.pericias).reduce((n, p) => n + Math.max(0, p.fontes.length - 1), 0);
  const substitutasOk = substitutas.filter((id) => !jaTem.has(id)).slice(0, repetidas);
  const periciasClasseOpcoes = classeCat?.pericias ? (classeCat.pericias.opcoes ?? PERICIAS.map((p) => p.id as string)).filter((id) => !semClasse.pericias[id]) : [];
  const build: Build = useMemo(() => ({ ...buildBase, ...(substitutasOk.length ? { periciasExtras: substitutasOk } : {}) }), [buildBase, substitutasOk]);
  const tentativa: FichaDnd = useMemo(() => ({ ...ficha, build }), [ficha, build]);
  const calc = useMemo(() => derivar(tentativa, cat, opcoes), [tentativa, cat, opcoes]);

  // subclasse já no 1º nível (bruxo: Patrono; clérigo: Domínio; feiticeiro: Origem)
  const subclasses = classeCat?.subclasses ?? [];
  const subclasseNo1 = classeCat?.subclasseNivel === 1 && subclasses.length > 0;

  // magias do 1º nível: limites da classe com os atributos finais (mesma conta da ficha pronta)
  const fichaClasse = useMemo(() => {
    if (!classeId) return null;
    const ef = fichaEfetiva(tentativa, calc, cat);
    return ef.classe ? definirClasse(ef, ef.classe) : ef;
  }, [tentativa, calc, cat, classeId]);
  const lim = fichaClasse ? limitesMagia(fichaClasse) : null;
  const conjura = !!lim && (lim.truques > 0 || (fichaClasse?.espacos[0]?.total ?? 0) > 0);
  const maxTruques = conjura ? lim!.truques : 0;
  // o mago guarda 6 magias no grimório e prepara só parte delas
  const maxMagias = conjura ? (classeId === "mago" ? 6 : lim!.magias) : 0;
  const truquesEsc = escolhidas.filter((m) => m.nivel === 0);
  const magiasEsc = escolhidas.filter((m) => m.nivel > 0);
  const passos: Passo[] = ["Raça", "Classe", "Antecedente", "Atributos", "Vida", ...(conjura ? ["Magias" as const] : []), "Equipamento", "Revisão"];
  const atual = passos[Math.min(passo, passos.length - 1)];
  const avaliarMagia = (m: MagiaCat): { ok: boolean; motivo?: string } => {
    const expandida = classeId === "bruxo" && !!subclasse && (LISTA_EXPANDIDA[subclasse] ?? []).includes(m.id);
    if (!m.classes.includes(classeId) && !expandida) return { ok: false, motivo: `Não está na lista de magias de ${classeCat?.nome ?? "sua classe"}.` };
    if (m.nivel > 1) return { ok: false, motivo: "No 1º nível só há espaços de 1º círculo." };
    if (m.nivel === 0 && truquesEsc.length >= maxTruques) return { ok: false, motivo: `Você já escolheu os ${maxTruques} truques que a classe conhece.` };
    if (m.nivel === 1 && magiasEsc.length >= maxMagias) return { ok: false, motivo: `Você já escolheu as ${maxMagias} magias de 1º círculo.` };
    return { ok: true };
  };

  // equipamento: opções do livro ou compra com a riqueza inicial
  const gastoCompras = compras.reduce((t, c) => t + c.custo, 0);
  const restoCobre = Math.max(0, (riqueza ?? 0) * 100 - gastoCompras);
  const moedasCompra = { pc: restoCobre % 10, pp: Math.floor((restoCobre % 100) / 10), pe: 0, po: Math.floor(restoCobre / 100), pl: 0 };
  const pendenciasEq = modoEquip === "classe" ? (classeId ? equipamentoPendente(classeId, opcaoEq, escolhasEq) : 1) : riqueza === null || (compras.length > 0 && !compraConfirmada) ? 1 : 0;
  const modCon = modificador(calc.atributos.con.total);
  const pvTotal = calc.pvMax.total;

  // atributos: valor de cada método
  const valoresRolados = rolagens.map((r) => r.total);
  const atribuidos = ATRIBUTOS.map((a) => indices[a]).filter((i): i is number => i !== undefined);
  const atributosOk = metodo === "padrao" ? usaCadaValorUmaVez(valores, DISTRIBUICAO_PADRAO)
    : metodo === "compra" ? (custoCompra(valores) ?? 99) <= ORCAMENTO_COMPRA
    : metodo === "rolagem" ? valoresRolados.length === 6 && atribuidos.length === 6 && new Set(atribuidos).size === 6
    : ATRIBUTOS.every((a) => valores[a] >= 3 && valores[a] <= 20);
  const gasto = custoCompra(valores);

  const escolhasPendentes = (calc.fontes.flatMap((f) => f.pendentes).length) + Math.max(0, (classeCat?.pericias?.qtd ?? 0) - periciasClasse.length) + (repetidas - substitutasOk.length);
  const podeAvancar = {
    Raça: !!raca && (!racaCat?.sub || !!raca.sub),
    Classe: !!classeCat && periciasClasse.length === (classeCat.pericias?.qtd ?? 0) && (!subclasseNo1 || !!subclasse),
    Antecedente: !!antecedente && substitutasOk.length === repetidas,
    Atributos: atributosOk,
    Vida: modoVida !== "rolar" || dadoVidaRolado !== null,
    Magias: true,
    Equipamento: pendenciasEq === 0,
    Revisão: true,
  }[atual];

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

  /** Itens que o equipamento da classe gera (opções A/B escolhidas), já como itens da ficha. */
  const itensDaClasse = (): Item[] => {
    const grupos = EQUIPAMENTO_INICIAL[classeId] ?? [];
    const itens = grupos.flatMap((g, gi) => {
      const oi = g.length === 1 ? 0 : opcaoEq[gi];
      return oi === undefined ? [] : itensDaOpcao(g[oi], gi, oi, escolhasEq, cat).flatMap(({ item, qtd }) => itensParaAdicionar(item, cat).map((x) => ({ ...x, quantidade: x.quantidade * qtd })));
    });
    return equiparInicial(itens, cat);
  };

  const concluir = () => {
    const viol = validar(tentativa, cat, opcoes);
    if (bloqueia(papel, viol)) { setErro(viol.filter((v) => v.gravidade !== "aviso").map((v) => v.mensagem).join(" ")); return; }
    if (!window.confirm("Aplicar este personagem? Raça, classe, antecedente, atributos, perícias e PV da ficha serão substituídos.")) return;
    const ef = fichaEfetiva(tentativa, calc, cat);
    const comClasse = ef.classe ? definirClasse(ef, ef.classe) : ef;
    const daClasse = modoEquip === "classe";
    const itensNovos = daClasse ? itensDaClasse() : equiparInicial(compras.flatMap((c) => c.itens), cat);
    const moedas = daClasse
      ? { ...ficha.moedas, po: ficha.moedas.po + ouroDoAntecedente(antCat?.equipamento) }
      : { ...ficha.moedas, pc: ficha.moedas.pc + moedasCompra.pc, pp: ficha.moedas.pp + moedasCompra.pp, po: ficha.moedas.po + moedasCompra.po };
    onSalvar({
      ...tentativa, nome: nome || ficha.nome,
      atrConjuracao: comClasse.atrConjuracao, espacos: comClasse.espacos,
      pv: calc.pvMax.total, pvTemp: 0, morteSucessos: 0, morteFalhas: 0, dadosVidaUsados: 0, descansosCurtos: 0,
      xp: 0, recursos: {}, ativos: [], condicoes: [], exaustao: 0,
      itens: itensNovos, moedas,
      magias: [...truquesEsc, ...magiasEsc].map((m, i) => magiaParaFicha(m, uid(), m.nivel === 0 || i - truquesEsc.length < (lim?.magias ?? 0))),
      equipamento: daClasse && antCat?.equipamento ? `Equipamento do antecedente (${antCat.nome}): ${antCat.equipamento}` : "",
    });
    onFechar();
  };

  const escolhasRaca = [...(racaCat?.escolhas ?? []), ...(racaCat?.sub?.find((s) => s.id === raca?.sub)?.escolhas ?? [])];
  const mudaEscolhasRaca = (id: string, v: string[]) => setRaca((r) => (r ? { ...r, escolhas: { ...r.escolhas, [id]: v } } : r));
  const mudaEscolhasAnt = (id: string, v: string[]) => setAntecedente((a) => (a ? { ...a, escolhas: { ...a.escolhas, [id]: v } } : a));

  return (
    <Moldura titulo="Criação de personagem" onFechar={onFechar}>
      <ol className="mb-3 flex flex-wrap gap-1 text-[11px]">
        {passos.map((p, i) => (
          <li key={p}><button onClick={() => i <= passo && setPasso(i)} disabled={i > passo} className={`rounded-full border px-2.5 py-0.5 ${i === passo ? "border-gold bg-gold/20 font-semibold text-gold" : i < passo ? "border-gold/40 text-gold/80" : "border-border text-muted"}`}>{i + 1}. {p}</button></li>
        ))}
      </ol>

      <div className="space-y-3 text-sm">
        {atual === "Raça" && (
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
                  <ul className="mt-1 space-y-1.5 text-xs">{[...(racaCat.tracos ?? []), ...(racaCat.sub?.find((s) => s.id === raca?.sub)?.tracos ?? [])].map((t, k) => <li key={`${t.id}-${k}`}><strong className="text-gold">{t.nome}</strong><TextoLivro texto={t.texto} /></li>)}</ul>
                </details>
              </div>
            )}
          </section>
        )}

        {atual === "Classe" && (
          <section className={secao}>
            <label className={rotulo}>Classe
              <select value={classeId} onChange={(e) => { setClasseId(e.target.value); setPericiasClasse([]); setSubclasse(undefined); setEscolhidas([]); }} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`}>
                <option value="">Escolha…</option>
                {cat.classes().map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            {classeCat && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted">Dado de vida d{classeCat.dadoVida} · Salvaguardas: {classeCat.salvaguardas.map((a) => ATRIBUTO_NOME[a as Atributo]).join(" e ")} · Armaduras: {classeCat.armaduras} · Armas: {classeCat.armas}</p>
                {classeCat.pericias && <EscolhaCampos def={{ id: "pericias", rotulo: `Perícias de ${classeCat.nome}`, tipo: "pericia", qtd: classeCat.pericias.qtd, opcoes: periciasClasseOpcoes }} valores={periciasClasse} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={setPericiasClasse} />}
                {classeCat.pericias && periciasClasseOpcoes.length < (classeCat.pericias.opcoes ?? PERICIAS).length && <p className="text-[11px] text-muted">Perícias que a raça ou o antecedente já dão não aparecem na lista.</p>}
                <p className="text-xs font-semibold text-gold">Características do 1º nível</p>
                <ul className="space-y-1 text-xs">{(classeCat.caracteristicas ?? []).filter((c) => (c.nivel ?? 1) <= 1).map((c, k) => (
                  <li key={`${c.id}-${k}`} className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5"><details><summary className="cursor-pointer font-semibold">{c.nome}</summary><TextoLivro texto={c.texto} className="mt-1" /></details></li>
                ))}</ul>
                {subclasseNo1 && (
                  <div className="space-y-1.5">
                    <label className={rotulo}>{classeCat.subclasseRotulo ?? "Subclasse"} (1º nível)
                      <select value={subclasse ?? ""} onChange={(e) => setSubclasse(e.target.value || undefined)} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground ${subclasse ? "" : "!border-gold"}`} aria-required>
                        <option value="">Escolha (obrigatória)…</option>
                        {subclasses.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                    </label>
                    {subclasses.find((x) => x.id === subclasse) && (
                      <ul className="space-y-1 text-xs">{subclasses.find((x) => x.id === subclasse)!.caracteristicas.map((c, k) => (
                        <li key={`${c.id}-${k}`} className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5"><details><summary className="cursor-pointer font-semibold">{c.nome}</summary><TextoLivro texto={c.texto} className="mt-1" /></details></li>
                      ))}</ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {atual === "Antecedente" && (
          <section className={secao}>
            <label className={rotulo}>Antecedente
              <select value={antecedente?.id ?? ""} onChange={(e) => { setAntecedente(e.target.value ? { id: e.target.value } : undefined); setSubstitutas([]); }} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`}>
                <option value="">Escolha…</option>
                {cat.antecedentes().map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
            {antCat && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted"><strong className="text-foreground">Perícias:</strong> {(antCat.concede?.pericias ?? []).map(nomePericia).join(", ") || "nenhuma"}{antCat.concede?.ferramentas?.length ? ` · Ferramentas: ${antCat.concede.ferramentas.join(", ")}` : ""}</p>
                {repetidas > 0 && (
                  <div className="rounded-lg border border-gold/40 bg-gold/10 p-2">
                    <p className="mb-1 text-xs text-gold">
                      {Object.entries(semExtras.pericias).filter(([, p]) => p.fontes.length > 1).map(([id, p]) => `${nomePericia(id)} (${p.fontes.join(" e ")})`).join("; ")} já {repetidas > 1 ? "vêm de mais de uma fonte" : "vem de mais de uma fonte"}: pelo livro, escolha {repetidas > 1 ? `${repetidas} outras perícias` : "outra perícia"} no lugar.
                    </p>
                    <EscolhaCampos def={{ id: "pericia-substituta", rotulo: "Perícia no lugar da repetida", tipo: "pericia", qtd: repetidas, opcoes: PERICIAS.map((p) => p.id as string).filter((id) => !jaTem.has(id) || substitutasOk.includes(id)) }} valores={substitutasOk} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={setSubstitutas} />
                  </div>
                )}
                {(antCat.escolhas ?? []).map((d) => <EscolhaCampos key={d.id} def={d} valores={antecedente?.escolhas?.[d.id] ?? []} cat={cat} opcoesMesa={opcoes} magias={magias} onChange={(v) => mudaEscolhasAnt(d.id, v)} />)}
                {antCat.caracteristica && <div className="rounded-lg border border-border bg-background/50 px-2.5 py-1.5 text-xs"><details><summary className="cursor-pointer font-semibold">{antCat.caracteristica.nome}</summary><TextoLivro texto={antCat.caracteristica.texto} className="mt-1" /></details></div>}
                {antCat.equipamento && <p className="text-xs text-muted"><strong className="text-foreground">Equipamento:</strong> {antCat.equipamento}</p>}
              </div>
            )}
          </section>
        )}

        {atual === "Atributos" && (
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

        {atual === "Vida" && (
          <section className={secao}>
            <p className="text-xs text-muted">Pontos de vida do 1º nível: o dado de vida da classe (d{dadoVida}) mais o modificador de Constituição ({sinal(modCon)}).</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {([
                ["maximo", "Máximo (regra do livro)", `${dadoVida} + Con = ${Math.max(1, dadoVida + modCon)}`],
                ["media", "Média", `${pvMedioDoDado(dadoVida)} (média + 1) + Con = ${Math.max(1, pvMedioDoDado(dadoVida) + modCon)}`],
                ["rolar", "Rolar o dado", dadoVidaRolado !== null ? `${dadoVidaRolado} + Con = ${Math.max(1, dadoVidaRolado + modCon)}` : `1d${dadoVida} + Con`],
              ] as const).map(([m, r, d]) => (
                <button key={m} aria-pressed={modoVida === m} onClick={() => setModoVida(m)} className={`rounded-xl border p-2.5 text-left ${modoVida === m ? "border-gold bg-gold/15" : "border-border hover:border-gold/60"}`}>
                  <strong className={`block text-sm ${modoVida === m ? "text-gold" : ""}`}>{r}</strong>
                  <span className="text-xs text-muted">{d}</span>
                </button>
              ))}
            </div>
            {modoVida === "rolar" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <button onClick={() => setDadoVidaRolado(rolar(`1d${dadoVida}`)?.total ?? 1)} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-semibold text-gold hover:bg-gold/20">{dadoVidaRolado === null ? `Rolar 1d${dadoVida}` : "Rolar de novo"}</button>
                <label className="flex items-center gap-1 text-muted">ou informe o dado rolado na mesa
                  <input type="number" min={1} max={dadoVida} value={dadoVidaRolado ?? ""} onChange={(e) => setDadoVidaRolado(e.target.value === "" ? null : Math.min(dadoVida, Math.max(1, Number(e.target.value) || 1)))} className={`${campo} !w-16 text-center`} aria-label={`Resultado do d${dadoVida}`} />
                </label>
                {dadoVidaRolado === null && <span className="text-gold">Role o dado para continuar.</span>}
              </div>
            )}
            <p className="mt-3 text-sm">PV iniciais: <strong className="text-gold">{pvTotal}</strong></p>
          </section>
        )}

        {atual === "Magias" && classeCat && (
          <section className={secao}>
            <p className="text-xs text-muted">Escolha as magias de {classeCat.nome} do 1º nível no compêndio (só valem as da lista da classe). Dá para trocar depois na ficha.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {maxTruques > 0 && <span>Truques: <strong className={truquesEsc.length === maxTruques ? "text-ok" : "text-gold"}>{truquesEsc.length}/{maxTruques}</strong></span>}
              {maxMagias > 0 && <span>Magias de 1º círculo: <strong className={magiasEsc.length === maxMagias ? "text-ok" : "text-gold"}>{magiasEsc.length}/{maxMagias}</strong>{classeId === "mago" && lim ? <span className="text-xs text-muted"> (grimório; prepara {lim.magias})</span> : null}</span>}
              <button onClick={() => setCompendioAberto(true)} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold hover:bg-gold/20">Abrir o compêndio</button>
            </div>
            {escolhidas.length === 0 ? <p className="mt-2 text-xs text-muted">Nenhuma magia escolhida ainda.</p> : (
              <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-background/50 text-sm">
                {[...truquesEsc, ...magiasEsc].map((m) => (
                  <li key={m.id} className="flex items-center gap-2 px-2.5 py-1">
                    <span className="min-w-0 flex-1 truncate">{m.nome} <span className="text-xs text-muted">{m.nivel === 0 ? "truque" : "1º círculo"} · {cap1(m.escola)}</span></span>
                    <button onClick={() => setEscolhidas((x) => x.filter((y) => y.id !== m.id))} className="text-xs text-muted hover:text-danger" aria-label={`Remover ${m.nome}`}>remover</button>
                  </li>
                ))}
              </ul>
            )}
            {(truquesEsc.length < maxTruques || magiasEsc.length < maxMagias) && <p className="mt-2 text-xs text-gold">Ainda faltam magias: você pode seguir e completar depois na aba Magias.</p>}
          </section>
        )}

        {atual === "Equipamento" && (
          <section className={secao}>
            <div className="mb-3 flex flex-wrap gap-2">
              {([["classe", "Equipamento da classe"], ["compra", "Comprar com a riqueza inicial"]] as const).map(([m, r]) => (
                <button key={m} aria-pressed={modoEquip === m} onClick={() => setModoEquip(m)} className={`rounded-full border px-3 py-1 text-xs ${modoEquip === m ? "border-gold bg-gold/20 font-semibold text-gold" : "border-border text-muted hover:text-foreground"}`}>{r}</button>
              ))}
            </div>
            {!classeCat && <p className="text-xs text-muted">Escolha uma classe no passo 2.</p>}

            {classeCat && modoEquip === "classe" && (
              <div className="space-y-3">
                <p className="text-xs text-muted">Você começa com o equipamento abaixo, além do que o antecedente concede. Escolha uma opção em cada linha.</p>
                {(EQUIPAMENTO_INICIAL[classeCat.id] ?? []).map((g, gi) => {
                  const oi = g.length === 1 ? 0 : opcaoEq[gi];
                  return (
                    <fieldset key={gi} className="rounded-lg border border-border bg-background/50 p-2">
                      <legend className="px-1 text-[11px] uppercase tracking-wider text-muted">{g.length === 1 ? "Fixo" : `Escolha ${gi + 1}`}</legend>
                      <div className="flex flex-wrap gap-2">
                        {g.map((op, k) => (
                          g.length === 1
                            ? <span key={k} className="text-sm">{op.rotulo}</span>
                            : <button key={k} aria-pressed={oi === k} onClick={() => setOpcaoEq((x) => ({ ...x, [gi]: k }))} className={`rounded-lg border px-2.5 py-1 text-xs ${oi === k ? "border-gold bg-gold/15 font-semibold text-gold" : "border-border hover:border-gold/60"}`}>{String.fromCharCode(97 + k)}) {op.rotulo}</button>
                        ))}
                      </div>
                      {oi !== undefined && g[oi].itens.map((it, k) => it.escolher && (
                        <label key={k} className="mt-2 block text-[11px] uppercase tracking-wider text-muted">{it.rotulo ?? "Item"}
                          <select value={escolhasEq[chaveEscolha(gi, oi, k)] ?? ""} onChange={(e) => setEscolhasEq((x) => ({ ...x, [chaveEscolha(gi, oi, k)]: e.target.value }))} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`}>
                            <option value="">Escolha…</option>
                            {itensDoSeletor(it.escolher, cat).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                          </select>
                        </label>
                      ))}
                    </fieldset>
                  );
                })}
                {antCat?.equipamento && <p className="text-xs text-muted"><strong className="text-foreground">Do antecedente ({antCat.nome}):</strong> {antCat.equipamento}{ouroDoAntecedente(antCat.equipamento) ? ` — as ${ouroDoAntecedente(antCat.equipamento)} po entram nas moedas.` : ""} O texto fica nas anotações do equipamento.</p>}
              </div>
            )}

            {classeCat && modoEquip === "compra" && (
              <div className="space-y-3">
                <p className="text-xs text-muted">Regra opcional do livro: em vez do equipamento da classe e do antecedente, role a riqueza inicial e compre o que quiser no catálogo.</p>
                {RIQUEZA_INICIAL[classeCat.id] ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>Riqueza de {classeCat.nome}: {RIQUEZA_INICIAL[classeCat.id].dados}{RIQUEZA_INICIAL[classeCat.id].vezes > 1 ? ` × ${RIQUEZA_INICIAL[classeCat.id].vezes}` : ""} po</span>
                    <button onClick={() => { setRiqueza((rolar(RIQUEZA_INICIAL[classeCat.id].dados)?.total ?? 0) * RIQUEZA_INICIAL[classeCat.id].vezes); setCompras([]); setCompraConfirmada(false); }} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold hover:bg-gold/20">{riqueza === null ? "Rolar" : "Rolar de novo"}</button>
                    <label className="flex items-center gap-1 text-xs text-muted">ou informe (po)
                      <input type="number" min={0} value={riqueza ?? ""} onChange={(e) => { setRiqueza(e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0)); setCompras([]); setCompraConfirmada(false); }} className={`${campo} !w-20 text-center`} aria-label="Riqueza inicial em po" />
                    </label>
                  </div>
                ) : <p className="text-xs text-muted">Esta classe não tem riqueza inicial cadastrada.</p>}
                {riqueza !== null && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Disponível: <strong className="text-gold">{emOuro(moedasCompra).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} po</strong> <span className="text-xs text-muted">de {riqueza} po</span></span>
                      <button onClick={() => { setCompraConfirmada(false); setCatalogoAberto(true); }} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold hover:bg-gold/20">{compraConfirmada ? "Alterar a compra" : "Abrir o catálogo e comprar"}</button>
                    </div>
                    {compras.length === 0 ? <p className="text-xs text-muted">Nada comprado ainda.</p> : (
                      <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-background/50 text-sm">
                        {compras.map((c, k) => (
                          <li key={k} className="flex items-center gap-2 px-2.5 py-1">
                            <span className="min-w-0 flex-1 break-words">{c.itens.map(nomeItem).join(", ")}</span>
                            <span className="text-xs text-muted">{(c.custo / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} po</span>
                            <button onClick={() => { setCompras((x) => x.filter((_, j) => j !== k)); setCompraConfirmada(false); }} className="text-xs text-muted hover:text-danger" aria-label="Devolver item">devolver</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {compras.length > 0 && (compraConfirmada
                      ? <p role="status" className="text-xs text-ok">✓ Compra concluída: ao criar o personagem os itens entram no inventário e as moedas já saem descontadas.</p>
                      : <button onClick={() => setCompraConfirmada(true)} className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/25">Concluir compra</button>)}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {atual === "Revisão" && (
          <section className={secao}>
            <label className={rotulo}>Nome do personagem
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={`${campo} mt-0.5 w-full normal-case tracking-normal text-foreground`} />
            </label>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              <div><dt className="text-muted">Raça</dt><dd className="font-semibold">{racaCat?.sub?.find((s) => s.id === raca?.sub)?.nome ?? racaCat?.nome}</dd></div>
              <div><dt className="text-muted">Classe</dt><dd className="font-semibold">{classeCat?.nome} 1</dd></div>
              <div><dt className="text-muted">Antecedente</dt><dd className="font-semibold">{antCat?.nome}</dd></div>
              <div><dt className="text-muted">PV</dt><dd className="font-semibold">{pvTotal}</dd></div>
              <div><dt className="text-muted">CA</dt><dd className="font-semibold">{calc.ca.total}</dd></div>
              <div><dt className="text-muted">Deslocamento</dt><dd className="font-semibold">{String(calc.deslocamento.total).replace(".", ",")} m</dd></div>
              <div className="col-span-full"><dt className="text-muted">Atributos</dt><dd className="font-semibold">{ATRIBUTOS.map((a) => `${ATRIBUTO_NOME[a].slice(0, 3)} ${calc.atributos[a].total} (${sinal(calc.mods[a])})`).join(" · ")}</dd></div>
              <div className="col-span-full"><dt className="text-muted">Perícias</dt><dd className="font-semibold">{Object.keys(calc.pericias).length ? Object.keys(calc.pericias).map(nomePericia).join(", ") : "—"}</dd></div>
              {escolhidas.length > 0 && <div className="col-span-full"><dt className="text-muted">Magias</dt><dd className="font-semibold">{[...truquesEsc, ...magiasEsc].map((m) => m.nome).join(", ")}</dd></div>}
              <div className="col-span-full"><dt className="text-muted">Equipamento</dt><dd className="font-semibold">{modoEquip === "classe" ? (itensDaClasse().map(nomeItem).join(", ") || "—") : `${compras.flatMap((c) => c.itens).map(nomeItem).join(", ") || "nada comprado"} · sobram ${emOuro(moedasCompra).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} po`}</dd></div>
            </dl>
            {escolhasPendentes > 0 && <p className="mt-2 text-xs text-gold">Ainda há {escolhasPendentes} escolha(s) pendente(s); volte aos passos anteriores ou termine depois na aba Personagem.</p>}
          </section>
        )}

        {erro && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-danger">{erro}</p>}
        <div className="flex justify-between gap-2">
          <button onClick={() => (passo === 0 ? onFechar() : setPasso(passo - 1))} className="rounded-lg border border-border px-3 py-1.5 text-muted hover:text-foreground">{passo === 0 ? "Cancelar" : "Voltar"}</button>
          {passo < passos.length - 1
            ? <button onClick={() => setPasso(passo + 1)} disabled={!podeAvancar} className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 font-semibold text-gold hover:bg-gold/25 disabled:opacity-40">Próximo</button>
            : <button onClick={concluir} className="rounded-lg border border-gold bg-gold/15 px-3 py-1.5 font-semibold text-gold hover:bg-gold/25">Criar personagem</button>}
        </div>
        {talentosOk && atual === "Raça" && <p className="text-xs text-muted">Talentos estão ligados nesta mesa: o humano variante está disponível.</p>}
      </div>
      {compendioAberto && (
        <CompendioMagias
          classeInicial={classeId}
          extras={classeId === "bruxo" && subclasse ? LISTA_EXPANDIDA[subclasse] : undefined}
          circuloMax={1}
          jaNaFicha={new Set(escolhidas.map((m) => m.id))}
          avaliar={avaliarMagia}
          rotuloAdicionar="Escolher esta magia"
          onAdicionar={(m) => setEscolhidas((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]))}
          onFechar={() => setCompendioAberto(false)}
        />
      )}
      {catalogoAberto && (
        <CatalogoEquipamento
          cat={cat}
          saldo={moedasCompra}
          compras={compras}
          proficiencias={{ armas: calc.armas.map((x) => x.nome), armaduras: calc.armaduras.map((x) => x.nome), ferramentas: calc.ferramentas.map((x) => x.nome) }}
          podePagar={(custo) => totalEmCobre(moedasCompra) >= custo}
          onComprar={(novos, custo) => { if (custo && !pagar(moedasCompra, custo)) return; setCompras((x) => [...x, { itens: novos, custo }]); }}
          onDevolver={(k) => setCompras((x) => x.filter((_, j) => j !== k))}
          onConcluir={() => { setCompraConfirmada(true); setCatalogoAberto(false); }}
          onFechar={() => setCatalogoAberto(false)}
        />
      )}
    </Moldura>
  );
}


