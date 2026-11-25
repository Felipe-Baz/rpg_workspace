"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, Eye, FileUp, Lock, LockOpen, Heart, Link2, Minus, NotebookPen, Pencil, Plus, RotateCcw, Scale, Shield, Skull, Star, Swords, Theater, Trash2, Wind, type LucideIcon } from "lucide-react";
import CampoLongo from "./CampoLongo";
import { uid } from "@/lib/mesas";
import { useFichaPersonagem } from "@/lib/fichaPersonagem";
import {
  ATRIBUTOS, ATRIBUTO_NOME, FICHA_VAZIA, PERICIAS, bonusAtaqueMagia, bonusIniciativa, bonusPericia, bonusProficiencia, bonusSalvaguarda, cdMagia,
  MAX_DESCANSOS_CURTOS, atrDaMagia, classesDaFicha, ehConjuradora, nivelNaClasse, comSinal, contagemMagias, CLASSES, alternarMagia, circulosDisponiveis, definirClasse, limitesMagia, magiaPronta, nomeClasse, type ClasseId, temDadoVida, descansoCurto, descansoLongo, podeDescansoCurto, testeDadoVida, ALINHAMENTOS, modDe, percepcaoPassiva, pesoTotal, testeAtaque, testeAtributo,
  testeDano, testeDanoMagia, testeIniciativa, testePericia, testeSalvaguarda, type Atributo, type Ataque, type FichaDnd, type Item, type Magia, type NivelProf, type Teste,
} from "@/lib/dnd5e";
import LivroHistoria from "./LivroHistoria";
import PainelRolagem from "./PainelRolagem";
import TrocaMagias from "./TrocaMagias";
import CompendioMagias from "./CompendioMagias";
import CatalogoEquipamento, { type Compra } from "./CatalogoEquipamento";
import EstadoCombate from "./EstadoCombate";
import { Escudo, Gema, IconeEscola, Losango, Medalhao, corDaEscola } from "./ornamentos";
import { usePersistido } from "@/lib/persistido";
import AssistenteNivel from "./AssistenteNivel";
import AssistenteCriacao from "./AssistenteCriacao";
import { nivelPorXp, podeSubirDeNivel } from "@/lib/regras/dnd5e/progressao";
import { TIPOS_DE_DANO, aplicarCura, aplicarDano, comSugestao, danoDeFuria, defesasDe, estabilizar, estadoVital, modoDaJogada, salvaguardaDeMorte, type EstadoJogo, type Jogada } from "@/lib/regras/dnd5e/combate";
import { recursosCalculados, recursosDaFicha, restaurarRecursos } from "@/lib/regras/dnd5e/recursos";
import { MAX_SINTONIZADOS, emOuro, pagar, reembolsar, totalEmCobre, trocarMoedas } from "@/lib/regras/dnd5e/equipamento";
import type { Moeda } from "@/lib/regras/dnd5e/catalogo";
import { CaracteristicasPorFonte } from "./ConstrucaoPersonagem";
import { carregarCatalogoPhb, type Catalogo } from "@/lib/regras/dnd5e/catalogo";
import { derivar } from "@/lib/regras/dnd5e/derivar";
import { fichaEfetiva, gravavel } from "@/lib/regras/dnd5e/efetiva";
import { opcaoAtiva, type OpcoesMesa } from "@/lib/regras/sistema";
import { dnd5e } from "@/lib/regras/dnd5e/sistema";
import { carregarMagias, magiaParaFicha, type MagiaCat } from "@/lib/regras/dnd5e/magias";
import { classeFazRitual, conjurarMagia, encerrarConcentracao, maiorCirculo, planoDeConjuracao, podeAprender, testeConcentracao } from "@/lib/regras/dnd5e/conjuracao";

const campo = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const cartao = "cartao-rpg rounded-2xl border border-border bg-card p-4";
const titulo = "mb-3 flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.2em] text-gold";
const botaoRolar = "botao-d20 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-sm font-semibold text-gold hover:bg-gold/20";
const ABREV: Record<Atributo, string> = { for: "FOR", des: "DES", con: "CON", int: "INT", sab: "SAB", car: "CAR" };

function Num({ valor, onChange, min, className = "", disabled, title }: { valor: number; onChange: (n: number) => void; min?: number; className?: string; disabled?: boolean; title?: string }) {
  return (
    <input
      type="number"
      disabled={disabled}
      title={title}
      value={Number.isFinite(valor) ? valor : 0}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(Number.isFinite(n) ? (min !== undefined ? Math.max(min, n) : n) : 0);
      }}
      className={`${campo} text-center ${className}`}
    />
  );
}

/** Deslocamento como valor de leitura; na ficha manual um lápis abre a edição (não parece mais um campo de formulário). */
function ValorDeslocamento({ valor, editavel, titulo, onChange }: { valor: string; editavel: boolean; titulo?: string; onChange: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return <input autoFocus value={valor} onChange={(e) => onChange(e.target.value)} onBlur={() => setEditando(false)} onKeyDown={(e) => e.key === "Enter" && setEditando(false)} aria-label="Deslocamento" className={`${campo} !w-24 text-center`} />;
  }
  return (
    <p className="stat-valor" title={titulo}>
      {valor || "—"}
      {editavel && <button onClick={() => setEditando(true)} aria-label="Editar deslocamento" title="Editar" className="ml-1 align-middle text-muted hover:text-gold"><Pencil size={12} /></button>}
    </p>
  );
}

/** Valor numérico de leitura (pílula centralizada). Na ficha manual um lápis abre a edição; com a construção do livro só muda na criação ou ao subir de nível. */
function ValorNumero({ valor, editavel, titulo, onChange, min, max, rotulo }: { valor: number; editavel: boolean; titulo?: string; onChange: (n: number) => void; min?: number; max?: number; rotulo: string }) {
  const [editando, setEditando] = useState(false);
  if (editando) {
    return <input autoFocus type="number" value={valor} min={min} max={max} aria-label={rotulo} onChange={(e) => onChange(Math.min(max ?? 999, Math.max(min ?? 0, Number(e.target.value) || 0)))} onBlur={() => setEditando(false)} onKeyDown={(e) => e.key === "Enter" && setEditando(false)} className={`${campo} !w-16 !py-0.5 text-center`} />;
  }
  return (
    <p className="inline-flex min-w-10 items-center justify-center gap-1 rounded-full border border-gold/40 bg-card-2 px-2.5 py-0.5 text-sm font-semibold tabular-nums" title={titulo}>
      <span aria-label={rotulo}>{valor}</span>
      {editavel && <button onClick={() => setEditando(true)} aria-label={`Editar: ${rotulo}`} title="Editar" className="text-muted hover:text-gold"><Pencil size={11} /></button>}
    </p>
  );
}

/** Palavra com explicação ao passar o mouse (rótulos de caixas de seleção). */
function Dica({ texto, children }: { texto: string; children: React.ReactNode }) {
  return <span title={texto} className="cursor-help underline decoration-dotted underline-offset-2">{children}</span>;
}

const Texto = ({ rotulo, valor, onChange, linhas = 4, icone, dica, sugestoes }: { rotulo: string; valor: string; onChange: (v: string) => void; linhas?: number; icone?: LucideIcon; dica?: string; sugestoes?: string[] }) => (
  <CampoLongo rotulo={rotulo} valor={valor} onChange={onChange} linhas={linhas} icone={icone} dica={dica} sugestoes={sugestoes} />
);

type Aba = "combate" | "magias" | "tracos" | "inventario" | "personagem" | "historia";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "combate", rotulo: "Combate" }, { id: "magias", rotulo: "Magias" }, { id: "tracos", rotulo: "Traços" },
  { id: "inventario", rotulo: "Inventário" }, { id: "personagem", rotulo: "Personagem" }, { id: "historia", rotulo: "História" },
];

export default function FichaDnd5e({ mesaId, donoUid, nomePadrao = "", papel = "jogador", opcoes }: { mesaId: string; donoUid: string; nomePadrao?: string; /** o mestre passa por cima da lista de magias da classe */ papel?: "jogador" | "mestre"; /** regras opcionais da mesa (talentos, multiclasse) */ opcoes?: OpcoesMesa }) {
  const { ficha: bruta, carregado, salvar: salvarBruto } = useFichaPersonagem(mesaId, donoUid);
  // catálogo do livro: carregado sob demanda (precisa já se a ficha usa a construção, ou nas abas que a mostram)
  const [catLivro, setCatLivro] = useState<Catalogo | null>(null);
  const [aba, setAba] = useState<Aba>("combate");
  const [rolando, setRolando] = useState<{ t: Teste; seq: number } | null>(null);
  const [valorPv, setValorPv] = useState(1);
  const [novaMagia, setNovaMagia] = useState(0);
  const [circuloConj, setCirculoConj] = useState<Record<string, number>>({});
  const [importacao, setImportacao] = useState<{ ok: boolean; texto: string } | null>(null);
  const [importando, setImportando] = useState(false);
  // após o descanso longo: "perguntar" se quer trocar as magias ativas, "trocar" com o painel aberto
  const [trocaMagias, setTrocaMagias] = useState<"perguntar" | "trocar" | null>(null);
  const [compendio, setCompendio] = useState(false);
  const [catalogoEquip, setCatalogoEquip] = useState(false);
  // compras feitas nesta abertura do catálogo (dá para cancelar uma e recuperar o dinheiro)
  const [comprasCat, setComprasCat] = useState<Compra[]>([]);
  const [compacto, setCompacto] = usePersistido<boolean>("ficha-modo-combate", false);
  const [pulso, setPulso] = useState<"dano" | "cura" | "">("");
  const [assistente, setAssistente] = useState<"nivel" | "criacao" | null>(null);
  // "Refazer personagem": o assistente parte de uma ficha em branco e, ao concluir, substitui a ficha inteira
  const [refazer, setRefazer] = useState(false);
  // ficha sem nada cadastrado: oferece criação manual ou com o assistente (a escolha "manual" vale só nesta visita)
  const [manual, setManual] = useState(false);
  const [xpConceder, setXpConceder] = useState(100);
  const [tipoDano, setTipoDano] = useState("");
  const [danoCritico, setDanoCritico] = useState(false);
  const [logCombate, setLogCombate] = useState<string[]>([]);
  const [troca, setTroca] = useState<{ de: Moeda; para: Moeda; qtd: number }>({ de: "po", para: "pp", qtd: 1 });
  // magias do catálogo (para rolagens escaladas); carrega só quando a aba Magias é aberta
  const [catalogo, setCatalogo] = useState<Map<string, MagiaCat>>(new Map());
  // dano recém-sofrido enquanto concentrado: oferece o teste de Constituição
  const [danoConc, setDanoConc] = useState<number | null>(null);
  const fichaEmBranco = useMemo<FichaDnd>(() => ({ ...FICHA_VAZIA, nome: bruta.nome }), [bruta.nome]);
  const precisaCatalogo = true; // o cabeçalho usa o catálogo (subclasses)
  useEffect(() => {
    if (!precisaCatalogo) return;
    let vivo = true;
    carregarCatalogoPhb().then((c) => vivo && setCatLivro(c)).catch(() => {});
    return () => { vivo = false; };
  }, [precisaCatalogo]);
  // ficha com os valores calculados pelo livro (se houver `build`); `salvar` devolve os derivados antes de gravar
  const calc = useMemo(() => (bruta.build && catLivro ? derivar(bruta, catLivro, opcoes) : null), [bruta, catLivro, opcoes]);
  const f = bruta.build && catLivro && calc ? fichaEfetiva(bruta, calc, catLivro) : bruta;
  const auto = !!bruta.build;
  const salvar = (x: FichaDnd) => salvarBruto(gravavel(bruta, x));
  useEffect(() => {
    if (aba !== "magias") return;
    let vivo = true;
    carregarMagias().then((l) => vivo && setCatalogo(new Map(l.map((m) => [m.id, m])))).catch(() => {});
    return () => { vivo = false; };
  }, [aba]);

  if (!carregado || (bruta.build && !catLivro)) return <p className="py-10 text-center text-muted">Abrindo a ficha…</p>;

  // os assistentes são uma página no lugar da ficha (dentro do layout do site), não um popup
  if (assistente === "nivel" && catLivro) return <AssistenteNivel ficha={bruta} cat={catLivro} opcoes={opcoes} papel={papel} onSalvar={salvarBruto} onFechar={() => setAssistente(null)} />;
  if (assistente === "criacao" && catLivro) return <AssistenteCriacao ficha={refazer ? fichaEmBranco : bruta} cat={catLivro} opcoes={opcoes} papel={papel} onSalvar={salvarBruto} onFechar={() => { setAssistente(null); setRefazer(false); }} />;

  const fichaNova = !bruta.build && !bruta.nome && !bruta.classe && !bruta.raca && !bruta.antecedente && !bruta.subclasse
    && bruta.nivel <= 1 && bruta.xp === 0 && bruta.magias.length === 0 && bruta.itens.length === 0 && bruta.ataques.length === 0 && !bruta.equipamento && !bruta.tracos;
  if (fichaNova && !manual) {
    return (
      <div className="ficha-rpg space-y-4">
        <section className="cartao-rpg rounded-2xl border-2 border-gold/50 bg-card p-6 text-center">
          <h2 className="font-display text-xl font-bold text-gold">{nomePadrao ? `${nomePadrao} ainda não tem ficha` : "Este personagem ainda não tem ficha"}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">Como você quer começar?</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button onClick={() => setAssistente("criacao")} disabled={!catLivro} className="rounded-xl border border-gold bg-gold/15 p-4 text-left hover:bg-gold/25 disabled:opacity-50">
              <strong className="block text-gold">Criar com o assistente</strong>
              <span className="text-sm text-muted">Passo a passo: raça, classe, antecedente e atributos, com tudo calculado pelo livro.</span>
            </button>
            <button onClick={() => setManual(true)} className="rounded-xl border border-border p-4 text-left hover:border-gold">
              <strong className="block">Criação manual</strong>
              <span className="text-sm text-muted">Abre a ficha em branco para você preencher cada campo.</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  // a aba Magias some para quem não conjura: classes sem conjuração, sem magias cadastradas e sem atributo de conjuração
  // (subclasses conjuradoras como Cavaleiro Místico e Trapaceiro Arcano, ou itens que dão magias, mantêm a aba)
  const conjura = !f.classe || classesDaFicha(f).some((c) => ehConjuradora(c.id as ClasseId)) || f.magias.length > 0 || !!f.atrConjuracao || /cavaleiro místico|trapaceiro arcano/i.test(f.subclasse);
  const abaAtual: Aba = aba === "magias" && !conjura ? "combate" : aba;
  // o jogador só compra pela ficha se o mestre liberar a opção da mesa (desligada por padrão); o mestre sempre pode
  const podeComprar = papel === "mestre" || opcaoAtiva(dnd5e, opcoes, "compras");
  // ficha publicada: identidade, atributos e proficiências travados para o jogador (o mestre edita sempre; subir de nível segue liberado)
  const travada = f.status === "publicada" && papel !== "mestre";
  const atrDaClasse = auto && !(f.classes && f.classes.length > 1) && !!f.classe && ehConjuradora(f.classe);
  const set = (p: Partial<FichaDnd>) => salvar({ ...f, ...p });
  const nomesRacas = catLivro ? catLivro.racas().flatMap((r) => [r.nome, ...(r.sub ?? []).filter((s) => s.id !== `${r.id}-padrao` && s.nome !== r.nome).map((s) => s.nome)]) : [];
  const antecedenteCat = catLivro?.antecedentes().find((a) => a.nome === f.antecedente);
  const nomesAntecedentes = catLivro ? catLivro.antecedentes().map((a) => a.nome) : [];
  const estado: EstadoJogo = { ...f, armaduraSemProf: calc?.armaduraSemProf };
  const rolar = (t: Teste, j?: Jogada) => setRolando({ t: j ? comSugestao(t, modoDaJogada(estado, j)) : t, seq: (rolando?.seq ?? 0) + 1 });
  const defsRecursos = recursosDaFicha(f, { racaId: bruta.build?.raca?.id, talentos: bruta.build?.talentos });
  const recursos = recursosCalculados(f, defsRecursos);
  const corpoACorpo = (a: Ataque) => !/munição/i.test(a.notas);
  /** Dano da arma com os bônus de características ligadas (Fúria soma ao dano corpo a corpo com Força). */
  const danoDoAtaque = (a: Ataque): Teste => {
    const t = testeDano(f, a);
    return (f.ativos ?? []).includes("furia") && a.atr === "for" && corpoACorpo(a) ? { ...t, partes: [...t.partes, { rotulo: "Fúria", valor: danoDeFuria(nivelNaClasse(f, "barbaro")) }] } : t;
  };
  const prof = bonusProficiencia(f.nivel);

  const aplicarPv = (tipo: "dano" | "cura") => {
    if (tipo === "cura") { set(aplicarCura(f, valorPv, pvMaxEf)); setLogCombate([`Curou ${valorPv} PV.`]); setPulso("cura"); return; }
    setPulso("dano");
    const defesas = defesasDe(f, calc?.resistencias.map((r) => r.nome));
    const r = aplicarDano(f, { valor: valorPv, tipo: tipoDano || undefined, critico: danoCritico, defesas });
    // chegar a 0 PV encerra a concentração; senão, oferece o teste de Constituição
    const ficha = r.caiu || r.morreu ? { ...r.ficha, concentracao: undefined } : r.ficha;
    set(ficha);
    setLogCombate([`Sofreu ${r.final} de dano${tipoDano ? ` (${tipoDano})` : ""}.`, ...r.texto]);
    if (f.concentracao && r.final > 0 && !r.caiu && !r.morreu) setDanoConc(r.final);
    else setDanoConc(null);
  };
  const vital = estadoVital(f);
  const pvMaxEf = Math.max(1, (f.exaustao ?? 0) >= 4 ? Math.floor(f.pvMax / 2) : f.pvMax);
  const aplicarMorte = (d20: number) => { const r = salvaguardaDeMorte(f, d20); set(r.ficha); setLogCombate([r.texto]); };

  const circuloDe = (m: Magia) => {
    if (m.nivel === 0) return 0;
    const cs = circulosDisponiveis(f, m.nivel);
    return cs.includes(circuloConj[m.id]) ? circuloConj[m.id] : (cs[0] ?? m.nivel);
  };
  const conjurarNaFicha = (m: Magia, circulo: number, ritual = false) => {
    const r = conjurarMagia(f, m, circulo, { ritual });
    if (!r.ok) return window.alert(r.motivo);
    if (r.encerrou && !window.confirm(`Conjurar ${m.nome} encerra a concentração em ${r.encerrou}. Continuar?`)) return;
    salvar(r.ficha);
    setDanoConc(null);
  };

  const setAtaque = (id: string, p: Partial<Ataque>) => set({ ataques: f.ataques.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const setItem = (id: string, p: Partial<Item>) => set({ itens: f.itens.map((i) => (i.id === id ? { ...i, ...p } : i)) });
  const setMagia = (id: string, p: Partial<Magia>) => set({ magias: f.magias.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  const cont = contagemMagias(f);
  const setEspaco = (i: number, p: Partial<{ total: number; usados: number }>) =>
    set({ espacos: f.espacos.map((e, k) => (k === i ? { ...e, ...p } : e)) });

  /** Lê o PDF oficial preenchido e substitui os dados da ficha (com confirmação). */
  const importarPdf = async (arquivo: File) => {
    setImportacao(null);
    setImportando(true);
    try {
      const { lerCamposPdf, fichaDeCampos } = await import("@/lib/importarFichaPdf");
      const campos = await lerCamposPdf(await arquivo.arrayBuffer());
      const { ficha: nova, resumo } = fichaDeCampos(campos, uid, f);
      if (!window.confirm(`Importar "${arquivo.name}" vai substituir todos os dados atuais desta ficha.\n\n${resumo}\n\nContinuar?`)) return;
      salvarBruto({ ...nova, build: undefined }); // a importação substitui tudo, inclusive a construção pelo livro
      setImportacao({ ok: true, texto: `Ficha importada. ${resumo}` });
    } catch (e) {
      setImportacao({ ok: false, texto: e instanceof Error ? e.message : "Não consegui importar esse PDF." });
    } finally {
      setImportando(false);
    }
  };

  const ciclo = (id: (typeof PERICIAS)[number]["id"]) => set({ pericias: { ...f.pericias, [id]: (((f.pericias[id] ?? 0) + 1) % 3) as NivelProf } });

  return (
    <div className={`ficha-rpg space-y-4 ${compacto ? "compacto" : ""}`}>
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
            onClick={() => { set({ ...restaurarRecursos(descansoLongo(f), defsRecursos, "longo"), exaustao: Math.max(0, (f.exaustao ?? 0) - 1) }); if (limitesMagia(f) && f.magias.length > 0) setTrocaMagias("perguntar"); }}
            title="Recupera tudo: PV, espaços de magia, dados de vida e descansos curtos"
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-gold"
          >
            <BedDouble size={14} /> Descanso longo
          </button>
          <button
            onClick={() => { const havia = temDadoVida(f); set(restaurarRecursos(descansoCurto(f), defsRecursos, "curto")); if (havia) rolar(testeDadoVida(f)); }}
            disabled={!podeDescansoCurto(f)}
            title="Até 2 por descanso longo: gasta 1 dado de vida (cura) e restaura todos os espaços de magia"
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted"
          >
            <BedDouble size={14} /> Descanso curto ({f.descansosCurtos}/{MAX_DESCANSOS_CURTOS})
          </button>
          {!travada && (
          <label
              title="Preenche a ficha com os valores do PDF “D&D 5ed - Ficha Editável” preenchido"
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-gold hover:text-gold ${importando ? "pointer-events-none opacity-50" : ""}`}
            >
              <FileUp size={14} /> {importando ? "Importando…" : "Importar PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={importando}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = ""; // permite escolher o mesmo arquivo de novo
                  if (arquivo) void importarPdf(arquivo);
                }}
              />
            </label>
          )}
        </div>
        {importacao && (
          <p role="status" className={`relative mt-3 text-sm ${importacao.ok ? "text-gold" : "text-red-400"}`}>{importacao.texto}</p>
        )}
        <fieldset disabled={travada} title={travada ? "Ficha publicada: só o mestre reabre para edição" : undefined} className={`relative m-0 mt-3 grid min-w-0 grid-cols-2 gap-2 border-0 p-0 sm:grid-cols-4 lg:grid-cols-7 ${compacto ? "hidden" : ""}`}>
          <label className="text-[11px] uppercase tracking-wider text-muted">
            Classe
            <select
              value={f.classe}
              disabled={auto}
              title={auto ? "Calculado pelo livro: mude na aba Personagem" : undefined}
              onChange={(e) => {
                const id = e.target.value as ClasseId | "";
                const novo = definirClasse(f, id);
                if (id !== f.classe && limitesMagia(novo) && !window.confirm(`Definir a classe como ${nomeClasse(id)}? Isso ajusta o atributo de conjuração e os espaços de magia ao nível ${f.nivel} e passa a limitar as magias ativas.`)) return;
                set(novo);
              }}
              className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`}
            >
              <option value="">Escolha…</option>
              {CLASSES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          {(() => {
            const cl = catLivro?.classe(f.classe);
            const subs = cl?.subclasses ?? [];
            const nivelSub = cl?.subclasseNivel ?? 3;
            const obrigatoria = subs.length > 0 && f.nivel >= nivelSub && !f.subclasse;
            const nomes = subs.map((s) => s.nome);
            return (
              <label className="text-[11px] uppercase tracking-wider text-muted">
                {cl?.subclasseRotulo ?? "Subclasse"}{subs.length > 0 ? ` (${nivelSub}º nível)` : ""}
                <select
                  value={f.subclasse}
                  disabled={auto || subs.length === 0}
                  title={auto ? "Calculado pelo livro: escolha ao subir de nível ou na aba Personagem" : subs.length === 0 ? (f.classe ? "Esta classe não tem subclasse no catálogo" : "Escolha a classe primeiro") : obrigatoria ? "Obrigatória a partir deste nível" : undefined}
                  aria-required={obrigatoria}
                  onChange={(e) => set({ subclasse: e.target.value })}
                  className={`${campo} mt-0.5 normal-case tracking-normal text-foreground ${obrigatoria ? "!border-gold" : ""}`}
                >
                  <option value="">{obrigatoria ? "Escolha (obrigatória)…" : f.nivel < nivelSub && subs.length > 0 ? `Disponível no ${nivelSub}º nível` : "—"}</option>
                  {f.subclasse && !nomes.includes(f.subclasse) && <option value={f.subclasse}>{f.subclasse}</option>}
                  {subs.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                </select>
              </label>
            );
          })()}
          {([["raca", "Raça", nomesRacas], ["antecedente", "Antecedente", nomesAntecedentes]] as const).map(([k, r, nomes]) => (
            <label key={k} className="text-[11px] uppercase tracking-wider text-muted">
              {r}
              <select value={f[k]} disabled={auto} title={auto ? "Calculado pelo livro: mude na aba Personagem" : undefined} onChange={(e) => set({ [k]: e.target.value })} className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`}>
                <option value="">Escolha…</option>
                {f[k] && !nomes.includes(f[k]) && <option value={f[k]}>{f[k]}</option>}
                {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          ))}
          <label className="text-[11px] uppercase tracking-wider text-muted">
            Alinhamento
            <select value={f.alinhamento} onChange={(e) => set({ alinhamento: e.target.value })} className={`${campo} mt-0.5 normal-case tracking-normal text-foreground`}>
              <option value="">Escolha…</option>
              {f.alinhamento && !ALINHAMENTOS.includes(f.alinhamento) && <option value={f.alinhamento}>{f.alinhamento}</option>}
              {ALINHAMENTOS.map((al) => <option key={al} value={al}>{al}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-wider text-muted">
            Nível
            <Num valor={f.nivel} min={1} disabled={auto} title={auto ? "Calculado pelo livro" : undefined} onChange={(n) => set({ nivel: Math.min(20, Math.max(1, n)) })} className="mt-0.5" />
          </label>
          <label className="text-[11px] uppercase tracking-wider text-muted">
            XP
            <Num valor={f.xp} min={0} onChange={(n) => set({ xp: n })} className="mt-0.5" />
          </label>
        </fieldset>
        <div className="relative mt-2 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => { setCompacto(!compacto); if (!compacto) setAba("combate"); }}
            aria-pressed={compacto}
            title="Mostra só o essencial para a mesa: PV, CA, ataques, magias, espaços e condições"
            className={`rounded-md border px-2 py-0.5 font-semibold ${compacto ? "border-gold bg-gold/20 text-gold" : "border-border text-muted hover:text-foreground"}`}
          >
            Modo combate{compacto ? " ✓" : ""}
          </button>
          {f.status === "publicada" ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-ok/50 px-2 py-0.5 font-semibold text-ok" title="Ficha publicada: identidade, atributos, proficiências e textos de personagem estão travados. Vida, magias, inventário, rolagens e subir de nível continuam liberados.">
              <Lock size={12} aria-hidden /> Publicada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-muted" title="Rascunho: tudo pode ser editado. Publique quando a ficha estiver pronta.">Rascunho</span>
          )}
          {f.status !== "publicada" ? (
            <button
              onClick={() => { if (window.confirm("Publicar a ficha? Identidade, atributos, proficiências e textos de personagem ficam travados e só o mestre pode reabrir. Vida, magias, inventário, rolagens e subir de nível continuam liberados.")) set({ status: "publicada" }); }}
              className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-semibold text-gold hover:bg-gold/20"
              title="Trava a ficha contra edições (só o mestre reabre)"
            ><Lock size={12} aria-hidden /> Publicar ficha</button>
          ) : papel === "mestre" && (
            <button
              onClick={() => { if (window.confirm("Voltar a ficha para rascunho? O jogador poderá editar tudo de novo.")) set({ status: "rascunho" }); }}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-muted hover:text-foreground"
              title="Reabre a ficha para edição"
            ><LockOpen size={12} aria-hidden /> Reabrir como rascunho</button>
          )}
          {podeSubirDeNivel(f.xp, f.nivel) && <span role="status" className="rounded-full border border-gold bg-gold/15 px-3 py-0.5 font-semibold text-gold">XP suficiente para o nível {nivelPorXp(f.xp)}!</span>}
          {f.nivel < 20 && (
            <button onClick={() => setAssistente("nivel")} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 font-semibold text-gold hover:bg-gold/20" title={auto ? "Assistente de subida de nível" : "Ative a construção pelo livro na aba Personagem para usar o assistente"}>Subir de nível</button>
          )}
          {papel === "mestre" && (
            <span className="ml-auto flex items-center gap-1 text-muted">
              Conceder XP
              <input type="number" min={1} value={xpConceder} onChange={(e) => setXpConceder(Math.max(1, Number(e.target.value) || 1))} aria-label="XP a conceder" className={`${campo} !w-24 !py-0.5 text-center`} />
              <button onClick={() => set({ xp: f.xp + xpConceder })} className="rounded-md border border-border px-2 py-0.5 text-foreground hover:border-gold">+ XP</button>
            </span>
          )}
        </div>
      </header>

      <div className={`grid gap-4 ${compacto ? "" : "lg:grid-cols-[17rem_1fr]"}`}>
        {/* Coluna esquerda: atributos, salvaguardas, perícias */}
        <div className={`space-y-4 ${compacto ? "hidden" : ""}`}>
          <section className={cartao}>
            <h2 className={titulo}>Atributos</h2>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
              {ATRIBUTOS.map((a) => (
                <div key={a} className="flex flex-col items-center gap-1.5 rounded-xl border border-gold/30 bg-background/60 px-2 py-2.5 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{ATRIBUTO_NOME[a]}</p>
                  <Medalhao>
                    <button
                      onClick={() => rolar(testeAtributo(f, a), { tipo: "teste", atributo: a })}
                      title={`Rolar teste de ${ATRIBUTO_NOME[a]}`}
                      className="flex h-full w-full items-center justify-center font-display text-2xl font-bold leading-none tabular-nums text-gold transition-transform hover:scale-110"
                    >
                      {comSinal(modDe(f, a))}
                    </button>
                  </Medalhao>
                  <ValorNumero valor={f.atributos[a]} editavel={!auto && !travada} min={1} max={30} rotulo={`Valor de ${ATRIBUTO_NOME[a]}`}
                    titulo={calc ? calc.atributos[a].partes.map((p, i) => `${i ? (p.valor >= 0 ? "+ " : "− ") : ""}${i ? Math.abs(p.valor) : p.valor} ${p.rotulo}`).join(" ") : "Só muda na criação do personagem ou ao subir de nível"}
                    onChange={(n) => set({ atributos: { ...f.atributos, [a]: n } })} />
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
                    disabled={auto || travada}
                    title="Proficiência na salvaguarda: soma o bônus de proficiência ao teste de resistência deste atributo"
                    onChange={(e) => set({ salvaguardas: { ...f.salvaguardas, [a]: e.target.checked } })}
                    aria-label={`Proficiência em salvaguarda de ${ATRIBUTO_NOME[a]}`}
                  />
                  <span className="flex-1">{ATRIBUTO_NOME[a]}</span>
                  <button onClick={() => rolar(testeSalvaguarda(f, a), { tipo: "salvaguarda", atributo: a })} className={botaoRolar}>{comSinal(bonusSalvaguarda(f, a))}</button>
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
                    <Losango
                      nivel={n}
                      onClick={() => !auto && !travada && ciclo(p.id)}
                      titulo={auto ? (calc?.pericias[p.id]?.fontes.join(", ") || "Sem proficiência") : "Alternar: sem proficiência, proficiente, especialista"}
                      rotulo={`Proficiência em ${p.nome}: ${n === 0 ? "nenhuma" : n === 1 ? "proficiente" : "especialista"}`}
                    />
                    <span className="flex-1 truncate">
                      {p.nome} <span className="text-[10px] uppercase text-muted">{ABREV[p.atr]}</span>
                    </span>
                    <button onClick={() => rolar(testePericia(f, p.id), { tipo: "teste", atributo: p.atr })} className={botaoRolar}>{comSinal(bonusPericia(f, p.id))}</button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-muted">Losango vazio: sem proficiência · cheio: proficiente · com anel: especialista.</p>
          </section>
        </div>

        {/* Coluna direita */}
        <div className="min-w-0 space-y-4">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`${cartao} cartao-stat`}>
              <Escudo valor={f.ca} disabled={auto || travada} titulo={calc ? calc.ca.partes.map((p, i) => `${i ? (p.valor >= 0 ? "+ " : "− ") : ""}${i ? Math.abs(p.valor) : p.valor} ${p.rotulo}`).join(" ") : undefined} onChange={(n) => set({ ca: n })} />
              <p className="stat-rotulo">Classe de armadura</p>
            </div>
            <div className={`${cartao} cartao-stat`}>
              <button onClick={() => rolar(testeIniciativa(f), { tipo: "iniciativa" })} className={`${botaoRolar} stat-rolar`} title="Rolar iniciativa">{comSinal(bonusIniciativa(f))}</button>
              <p className="stat-rotulo"><Swords size={12} className="mr-1 inline text-gold" aria-hidden />Iniciativa</p>
            </div>
            <div className={`${cartao} cartao-stat`}>
              <ValorDeslocamento valor={f.deslocamento} editavel={!auto && !travada} titulo={calc ? calc.deslocamento.partes.map((p) => `${p.valor} ${p.rotulo}`).join(" + ") : undefined} onChange={(v) => set({ deslocamento: v })} />
              <p className="stat-rotulo"><Wind size={12} className="mr-1 inline text-gold" aria-hidden />Deslocamento</p>
            </div>
            <div className={`${cartao} cartao-stat`}>
              <p className="stat-valor">{percepcaoPassiva(f)}</p>
              <p className="stat-rotulo">Percepção passiva</p>
            </div>
          </section>

          <section className={cartao}>
            <h2 className={titulo}><Heart size={14} className={f.pv > 0 && f.pv <= f.pvMax / 4 ? "coracao-baixo" : f.pv <= 0 ? "text-danger" : ""} aria-hidden /> Pontos de vida{f.pvTemp > 0 ? <span className="ml-1 normal-case tracking-normal text-sky-400">+{f.pvTemp} temporários</span> : null}</h2>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <label className="text-[10px] uppercase tracking-widest text-muted">Atuais<Num valor={f.pv} onChange={(n) => set({ pv: Math.max(0, n) })} className="mt-1 !text-xl font-bold" /></label>
                  <label className="text-[10px] uppercase tracking-widest text-muted">Máximos<Num valor={f.pvMax} min={1} disabled={auto || travada} title={calc ? calc.pvMax.partes.map((p) => `${p.valor} ${p.rotulo}`).join(" + ") : undefined} onChange={(n) => set({ pvMax: n })} className="mt-1 !text-xl font-bold" /></label>
                  <label className="text-[10px] uppercase tracking-widest text-muted">Temporários<Num valor={f.pvTemp} min={0} onChange={(n) => set({ pvTemp: n })} className="mt-1 !text-xl font-bold" /></label>
                </div>
                <div
                  className={`barra-pv mt-3 ${pulso ? `pulso-${pulso}` : ""}`}
                  onAnimationEnd={() => setPulso("")}
                  role="meter" aria-label="Pontos de vida" aria-valuemin={0} aria-valuemax={f.pvMax} aria-valuenow={f.pv}
                >
                  <div className="barra-pv-cheia" style={{ width: `${Math.min(100, Math.max(0, (f.pv / Math.max(1, f.pvMax)) * 100))}%` }} />
                  {f.pvTemp > 0 && <div className="barra-pv-temp" style={{ width: `${Math.min(100, (f.pvTemp / Math.max(1, f.pvMax)) * 100)}%` }} title={`${f.pvTemp} PV temporários`} />}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <button onClick={() => aplicarPv("dano")} className="rounded-lg border border-danger/50 px-3 py-1 text-danger hover:bg-danger/10"><Minus size={13} className="mr-1 inline" />Dano</button>
                  <Num valor={valorPv} min={1} onChange={setValorPv} className="!w-20" />
                  <button onClick={() => aplicarPv("cura")} className="rounded-lg border border-ok/50 px-3 py-1 text-ok hover:bg-ok/10"><Plus size={13} className="mr-1 inline" />Cura</button>
                  <select value={tipoDano} onChange={(e) => setTipoDano(e.target.value)} aria-label="Tipo do dano" className={`${campo} !w-auto !py-0.5 text-xs`}>
                    <option value="">tipo do dano…</option>
                    {TIPOS_DE_DANO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-muted" title="Acerto crítico: o dano é dobrado e, se o alvo está a 0 PV, conta como duas falhas na salvaguarda de morte."><input type="checkbox" checked={danoCritico} onChange={(e) => setDanoCritico(e.target.checked)} />crítico</label>
                </div>
                <p className="mt-1 text-[11px] text-muted">O dano passa por resistências, vulnerabilidades e imunidades, depois pelos PV temporários.</p>
                {logCombate.length > 0 && <ul role="status" className="mt-1 space-y-0.5 text-xs text-gold">{logCombate.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                {vital !== "vivo" && <p className="mt-1 text-xs font-semibold text-danger">{vital === "morto" ? "Morto" : vital === "estavel" ? "Estável (0 PV)" : "Inconsciente (0 PV)"}</p>}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-24 text-xs text-muted">Dados de vida</span>
                  <input value={f.dadoVida} disabled={auto || travada} onChange={(e) => set({ dadoVida: e.target.value })} className={`${campo} !w-14 text-center`} aria-label="Tipo do dado de vida" />
                  <Num valor={f.dadosVidaTotal - f.dadosVidaUsados} min={0} onChange={(n) => set({ dadosVidaUsados: Math.max(0, f.dadosVidaTotal - n) })} className="!w-14" />
                  <span className="text-muted">/</span>
                  <Num valor={f.dadosVidaTotal} min={0} disabled={auto || travada} onChange={(n) => set({ dadosVidaTotal: n })} className="!w-14" />
                </div>
                <button
                  onClick={() => { set({ dadosVidaUsados: f.dadosVidaUsados + 1 }); rolar(testeDadoVida(f)); }}
                  disabled={!temDadoVida(f)}
                  title="Gasta mais um dado de vida e rola a cura (dado + Constituição)"
                  className="ml-[6.5rem] rounded-md border border-gold/40 px-2 py-0.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-40"
                >
                  Gastar dado de vida
                </button>
                {f.pv <= 0 && vital === "inconsciente" && (
                  <div className="ml-[6.5rem] flex gap-2">
                    <button onClick={() => rolar({ titulo: "Salvaguarda de morte", dado: "1d20", d20: true, partes: [], morte: true })} className="rounded-md border border-danger/50 px-2 py-0.5 text-xs text-danger hover:bg-danger/10">Rolar salvaguarda de morte</button>
                    <button onClick={() => { set(estabilizar(f)); setLogCombate(["Estabilizado."]); }} className="rounded-md border border-border px-2 py-0.5 text-xs text-muted hover:text-foreground">Estabilizar</button>
                  </div>
                )}
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

          <nav role="tablist" className="flex flex-wrap gap-x-2 gap-y-1 border-b border-border">
            {ABAS.filter((a) => (a.id !== "magias" || conjura) && (!compacto || a.id === "combate" || a.id === "magias")).map((a) => (
              <button
                key={a.id}
                role="tab"
                aria-selected={abaAtual === a.id}
                onClick={() => setAba(a.id)}
                className={`marcador font-display text-sm tracking-wide ${abaAtual === a.id ? "text-gold" : "text-muted hover:text-foreground"}`}
              >
                {a.rotulo}
              </button>
            ))}
          </nav>

          {abaAtual === "combate" && (
            <section className={cartao}>
              <h2 className={titulo}><Shield size={14} /> Estado e recursos</h2>
              <EstadoCombate
                ficha={f}
                defs={defsRecursos}
                recursos={recursos}
                estado={estado}
                deslocamentoBase={parseFloat(f.deslocamento.replace(",", ".")) || 9}
                papel={papel}
                onMudar={set}
                onRolar={(t) => rolar(t)}
              />
            </section>
          )}

          {abaAtual === "combate" && (
            <section className={cartao}>
              <h2 className={titulo}><Swords size={14} /> Ataques</h2>
              {f.ataques.length === 0 && <p className="mb-3 text-sm text-muted">Nenhum ataque ainda. Adicione sua arma ou ataque natural.</p>}
              {auto && <p className="mb-3 text-xs text-muted">Armas equipadas no inventário viram linhas de ataque sozinhas, com proficiência, acuidade e versátil.</p>}
              <ul className="space-y-3">
                {f.ataques.map((a) => {
                  const modDano = modDe(f, a.atr) + a.bonusDano;
                  return (
                    <li key={a.id} className="rounded-xl border border-border bg-background/50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.derivado ? <span className="min-w-40 flex-1 font-semibold">{a.nome}{a.id !== "arma:desarmado" && <span className="ml-1 text-[10px] font-normal uppercase text-muted">arma equipada</span>}</span> : <input value={a.nome} onChange={(e) => setAtaque(a.id, { nome: e.target.value })} placeholder="Nome (Espada longa)" className={`${campo} min-w-40 flex-1`} />}
                        <button onClick={() => rolar(testeAtaque(f, a), { tipo: "ataque", corpo: corpoACorpo(a), atributo: a.atr })} className={botaoRolar} title="Rolar ataque">
                          Ataque {comSinal(modDe(f, a.atr) + (a.proficiente ? prof : 0) + a.bonusAtaque)}
                        </button>
                        <button onClick={() => rolar(danoDoAtaque(a))} className={botaoRolar} title="Rolar dano">
                          Dano {a.dano || "1d4"}{modDano !== 0 ? comSinal(modDano) : ""}
                        </button>
                        {!a.derivado && <button onClick={() => set({ ataques: f.ataques.filter((x) => x.id !== a.id) })} aria-label="Remover ataque" className="text-muted hover:text-danger"><Trash2 size={15} /></button>}
                      </div>
                      {a.derivado ? (
                        <p className="mt-1 text-xs text-muted">{ABREV[a.atr]}{a.proficiente ? " + proficiência" : " · sem proficiência"}{a.bonusAtaque ? ` · +${a.bonusAtaque} mágico` : ""} · {a.tipoDano}{a.notas ? ` · ${a.notas}` : ""}</p>
                      ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wider text-muted sm:grid-cols-6">
                        <label>
                          Atributo
                          <select value={a.atr} onChange={(e) => setAtaque(a.id, { atr: e.target.value as Atributo })} className={`${campo} mt-0.5`}>
                            {ATRIBUTOS.map((x) => <option key={x} value={x}>{ABREV[x]}</option>)}
                          </select>
                        </label>
                        <label className="flex items-end gap-1.5 pb-2 normal-case tracking-normal">
                          <input type="checkbox" checked={a.proficiente} onChange={(e) => setAtaque(a.id, { proficiente: e.target.checked })} /> <Dica texto="Soma o bônus de proficiência ao ataque. Marque se o personagem sabe usar esta arma (por classe, raça ou treino).">Proficiente</Dica>
                        </label>
                        <label>Bônus acerto<Num valor={a.bonusAtaque} onChange={(n) => setAtaque(a.id, { bonusAtaque: n })} className="mt-0.5" /></label>
                        <label>Dado de dano<input value={a.dano} onChange={(e) => setAtaque(a.id, { dano: e.target.value })} placeholder="1d8" className={`${campo} mt-0.5 text-center`} /></label>
                        <label>Bônus dano<Num valor={a.bonusDano} onChange={(n) => setAtaque(a.id, { bonusDano: n })} className="mt-0.5" /></label>
                        <label>Tipo<input value={a.tipoDano} onChange={(e) => setAtaque(a.id, { tipoDano: e.target.value })} placeholder="cortante" className={`${campo} mt-0.5`} /></label>
                      </div>
                      )}
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

          {abaAtual === "magias" && (
            <section className="space-y-4">
              <div className={cartao}>
                <h2 className={titulo}>Conjuração</h2>
                {!!f.classe && !ehConjuradora(f.classe) && <p className="mb-3 text-xs text-muted">{nomeClasse(f.classe)} não conjura magias por padrão. Você ainda pode cadastrar magias (itens, talentos, subclasses como Cavaleiro Místico) e escolher o atributo de conjuração abaixo.</p>}
                <div className="flex flex-wrap items-end gap-4">
                  <label className="text-[11px] uppercase tracking-wider text-muted">
                    Atributo
                    <select value={f.atrConjuracao} disabled={atrDaClasse} title={atrDaClasse ? "Definido pela classe" : undefined} onChange={(e) => set({ atrConjuracao: e.target.value as Atributo | "" })} className={`${campo} mt-0.5 !w-40`}>
                      <option value="">Não conjura</option>
                      {ATRIBUTOS.map((a) => <option key={a} value={a}>{ATRIBUTO_NOME[a]}</option>)}
                    </select>
                  </label>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted">CD da magia</p>
                    <p className="font-display text-2xl font-bold text-gold">{f.atrConjuracao ? cdMagia(f) : "—"}</p>
                    {f.classes && f.classes.length > 1 && <p className="text-[10px] text-muted">{f.classes.filter((c) => ehConjuradora(c.id as ClasseId)).map((c) => `${nomeClasse(c.id as ClasseId)} ${cdMagia(f, { classeOrigem: c.id })}`).join(" · ")}</p>}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Ataque de magia</p>
                    <p className="font-display text-2xl font-bold text-gold">{f.atrConjuracao ? comSinal(bonusAtaqueMagia(f)) : "—"}</p>
                  </div>
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
                          <Gema
                            key={k}
                            gasta={k < e.usados}
                            onClick={() => setEspaco(i, { usados: k < e.usados ? k : k + 1 })}
                            rotulo={`Espaço ${k + 1} do ${i + 1}º círculo: ${k < e.usados ? "gasto" : "disponível"}`}
                          />
                        ))}
                      </div>
                      <Num valor={e.total} min={0} onChange={(n) => setEspaco(i, { total: Math.min(n, 9), usados: Math.min(e.usados, n) })} className="!py-0.5 !text-xs" />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">Clique numa gema para marcar o espaço como gasto. O número abaixo é o total.</p>
              </div>

              <div className={cartao}>
                <h2 className={titulo}>Truques e magias</h2>
                {cont.lim ? (
                  <div className="mb-3 space-y-1 text-xs text-muted">
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Truques ativos <strong className={cont.truques > cont.lim.truques ? "text-danger" : cont.truquesCheio ? "text-gold" : "text-foreground"}>{cont.truques}/{cont.lim.truques}</strong></span>
                      <span>Magias ativas <strong className={cont.magias > cont.lim.magias ? "text-danger" : cont.magiasCheio ? "text-gold" : "text-foreground"}>{cont.magias}/{cont.lim.magias}</strong></span>
                      <button onClick={() => setTrocaMagias("trocar")} className="ml-auto text-accent-hover hover:underline">Trocar magias ativas</button>
                    </p>
                    <p>Cadastre quantas magias quiser: o limite da classe e do nível vale só para as <strong>ativas</strong>. Só magias ativas podem ser conjuradas. A troca é feita no descanso longo.</p>
                    <details>
                      <summary className="cursor-pointer hover:text-foreground">Ajustes especiais (itens mágicos, talentos)</summary>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wider">
                        {([["truques", "Truques"], ["magias", "Magias"]] as const).map(([k, r]) => (
                          <label key={k}>{r} (±)
                            <Num valor={f.ajusteLimites[k]} onChange={(n) => set({ ajusteLimites: { ...f.ajusteLimites, [k]: n } })} className="mt-0.5" />
                          </label>
                        ))}
                      </div>
                      <p className="mt-1">Some ou subtraia só quando algo raro mudar o limite da classe.</p>
                    </details>
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-muted">Escolha uma classe conjuradora no cabeçalho para aplicar os limites de truques e magias ativas.</p>
                )}
                {f.concentracao && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm">
                    <span>Concentrando em <strong className="text-gold">{f.concentracao.nome}</strong></span>
                    {danoConc !== null && (
                      <button onClick={() => rolar(testeConcentracao(f, danoConc), { tipo: "salvaguarda", atributo: "con" })} className={botaoRolar}>Teste de concentração (sofreu {danoConc})</button>
                    )}
                    <button onClick={() => { salvar(encerrarConcentracao(f)); setDanoConc(null); }} className="ml-auto text-accent-hover hover:underline">Encerrar concentração</button>
                  </div>
                )}
                {f.magias.length === 0 && <p className="mb-3 text-sm text-muted">Nenhuma magia ainda.</p>}
                {Array.from({ length: 10 }, (_, nv) => nv).map((nv) => {
                  const lista = f.magias.filter((m) => m.nivel === nv);
                  if (!lista.length) return null;
                  return (
                    <div key={nv} className="mb-4">
                      <h3 className="mb-1 border-b border-gold/20 pb-1 font-display text-sm text-gold">{nv === 0 ? "Truques" : `${nv}º círculo`}</h3>
                      <ul className="space-y-2">
                        {lista.map((m) => (
                          <li key={m.id} className="carta-magia rounded-xl border border-border p-2.5" style={{ "--escola-base": corDaEscola(m.escola) } as React.CSSProperties}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="selo-circulo" title={nv === 0 ? "Truque" : `${nv}º círculo`}>{nv === 0 ? "T" : nv}</span>
                              <IconeEscola escola={m.escola} />
                              {cont.lim && (() => {
                                const cheio = nv === 0 ? cont.truquesCheio : cont.magiasCheio;
                                return (
                                  <input
                                    type="checkbox"
                                    checked={m.ativa}
                                    disabled={!m.ativa && cheio}
                                    onChange={() => set(alternarMagia(f, m.id))}
                                    aria-label="Ativa"
                                    title={!m.ativa && cheio ? "Limite de ativas atingido: desative outra primeiro" : m.ativa ? "Magia ativa (preparada ou conhecida): pode ser conjurada. Clique para desativar." : "Magia inativa: está cadastrada mas não pode ser conjurada. Clique para ativar (respeita o limite da classe)."}
                                  />
                                );
                              })()}
                              <input value={m.nome} onChange={(e) => setMagia(m.id, { nome: e.target.value })} placeholder="Nome da magia" className={`${campo} min-w-40 flex-1`} />
                              {m.concentracao && <span className="selo-badge" title="Exige concentração">Conc.</span>}
                              {m.ritual && <span className="selo-badge" title="Pode ser conjurada como ritual">Ritual</span>}
                              {(["V", "S", "M"] as const).filter((c) => new RegExp(`(^|[^A-Za-z])${c}([^A-Za-z]|$)`).test(m.componentes.replace(/\(.*\)/, ""))).map((c) => <span key={c} className="glifo" title={c === "V" ? "Componente verbal" : c === "S" ? "Componente somático" : "Componente material"}>{c}</span>)}
                              {(nv > 0 || m.concentracao) && (() => {
                                const circulos = circulosDisponiveis(f, nv);
                                const pronta = magiaPronta(f, m);
                                const escolhido = circuloDe(m);
                                const motivo = !pronta ? "Ative a magia para conjurá-la" : nv > 0 && !circulos.length ? "Sem espaços de magia disponíveis" : "";
                                return (
                                  <span className="flex items-center gap-1">
                                    {nv > 0 && circulos.length > 1 && (
                                      <select value={escolhido} onChange={(e) => setCirculoConj({ ...circuloConj, [m.id]: Number(e.target.value) })} aria-label="Círculo do espaço a gastar" className={`${campo} !w-auto !py-0.5 !text-xs`}>
                                        {circulos.map((c) => <option key={c} value={c}>{c}º{c > nv ? " (maior)" : ""}</option>)}
                                      </select>
                                    )}
                                    <button disabled={!!motivo} title={motivo || (nv > 0 ? `Gasta 1 espaço do ${escolhido}º círculo` : "Conjurar")} onClick={() => conjurarNaFicha(m, escolhido)} className={`${botaoRolar} disabled:cursor-not-allowed disabled:opacity-40`}>
                                      Conjurar
                                    </button>
                                    {m.ritual && nv > 0 && classeFazRitual(f) && (
                                      <button title="Ritual: +10 minutos, não gasta espaço" onClick={() => conjurarNaFicha(m, nv, true)} className={botaoRolar}>Ritual</button>
                                    )}
                                  </span>
                                );
                              })()}
                              {(() => {
                                const plano = planoDeConjuracao(f, m, catalogo.get(m.catalogoId ?? ""), circuloDe(m));
                                const semDados = plano.danos.length === 0 && !plano.cura && plano.extras.length === 0;
                                return (
                                  <>
                                    {plano.ataque && <button onClick={() => rolar(plano.ataque!, { tipo: "ataque", corpo: false, atributo: atrDaMagia(f, m) || "int" })} className={botaoRolar}>Ataque {comSinal(bonusAtaqueMagia(f, m))}</button>}
                                    {plano.salvaguarda
                                      ? <span className="text-xs text-muted">CD <strong className="text-gold">{plano.salvaguarda.cd}</strong> · {ATRIBUTO_NOME[plano.salvaguarda.atributo]}</span>
                                      : m.tipo === "salvaguarda" && <span className="text-xs text-muted">CD <strong className="text-gold">{cdMagia(f, m)}</strong> · {ATRIBUTO_NOME[m.salvaguarda]}</span>}
                                    {plano.danos.map((t, i) => <button key={i} onClick={() => rolar(t)} className={botaoRolar} title={t.titulo}>Dano {t.dado}</button>)}
                                    {plano.dardos && <span className="text-xs text-muted" title="Quantidade de dardos ou raios">{plano.dardos} dardos/raios</span>}
                                    {plano.cura && <button onClick={() => rolar(plano.cura!)} className={botaoRolar}>Cura {plano.cura.dado}</button>}
                                    {plano.extras.map((t, i) => <button key={i} onClick={() => rolar(t)} className={botaoRolar} title={t.titulo}>{t.titulo.split(":")[0]} {t.dado}</button>)}
                                    {semDados && m.dano.trim() && <button onClick={() => rolar(testeDanoMagia(m))} className={botaoRolar}>Dano {m.dano}</button>}
                                  </>
                                );
                              })()}
                              <button onClick={() => set({ magias: f.magias.filter((x) => x.id !== m.id) })} aria-label="Remover magia" className="text-muted hover:text-danger"><Trash2 size={15} /></button>
                            </div>
                            <details className="mt-2 text-sm">
                              <summary className="cursor-pointer text-xs text-muted hover:text-foreground">Detalhes e descrição</summary>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wider text-muted sm:grid-cols-4">
                                {([["escola", "Escola"], ["tempo", "Tempo de conjuração"], ["alcance", "Alcance"], ["componentes", "Componentes"], ["duracao", "Duração"]] as const).map(([k, r]) => (
                                  <label key={k}>{r}<input value={m[k]} onChange={(e) => setMagia(m.id, { [k]: e.target.value })} className={`${campo} mt-0.5 normal-case tracking-normal`} /></label>
                                ))}
                                {f.classes && f.classes.length > 1 && (
                                  <label>Classe de conjuração
                                    <select value={m.classeOrigem ?? ""} onChange={(e) => setMagia(m.id, { classeOrigem: e.target.value || undefined })} className={`${campo} mt-0.5`}>
                                      <option value="">Padrão da ficha</option>
                                      {f.classes.filter((c) => ehConjuradora(c.id as ClasseId)).map((c) => <option key={c.id} value={c.id}>{nomeClasse(c.id as ClasseId)}</option>)}
                                    </select>
                                  </label>
                                )}
                                <label>Círculo<Num valor={m.nivel} min={0} onChange={(n) => setMagia(m.id, { nivel: Math.min(9, n) })} className="mt-0.5" /></label>
                                <label className="flex items-end gap-1.5 pb-1.5 normal-case tracking-normal" title="Magia que o personagem sempre tem pronta (de domínio, juramento, subclasse...): não conta no limite de magias ativas."><input type="checkbox" checked={!!m.sempre} onChange={(e) => setMagia(m.id, { sempre: e.target.checked || undefined })} /><span className="cursor-help underline decoration-dotted underline-offset-2">Sempre preparada</span></label>
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
                    title={(novaMagia === 0 ? cont.truquesCheio : cont.magiasCheio) ? "Limite de ativas atingido: a nova entra como inativa" : undefined}
                    onClick={() => set({ magias: [...f.magias, { id: uid(), nome: "", nivel: novaMagia, ativa: !(novaMagia === 0 ? cont.truquesCheio : cont.magiasCheio), escola: "", tempo: "1 ação", alcance: "", componentes: "", duracao: "", descricao: "", tipo: "nenhum", dano: "", salvaguarda: "des" }] })}
                    className="text-accent-hover hover:underline"
                  >
                    + Adicionar {novaMagia === 0 ? "truque" : "magia"}
                  </button>
                  <button onClick={() => setCompendio(true)} className="ml-auto text-accent-hover hover:underline">Do catálogo…</button>
                </div>
              </div>
            </section>
          )}

          {abaAtual === "tracos" && (
            <section className={`${cartao} space-y-4`}>
              {calc && <CaracteristicasPorFonte calc={calc} />}
              <fieldset disabled={travada} className="m-0 min-w-0 space-y-4 border-0 p-0">
                <Texto rotulo="Características, traços de raça e classe, talentos" valor={f.tracos} onChange={(v) => set({ tracos: v })} linhas={10} />
                <Texto rotulo="Outras proficiências e idiomas" valor={f.proficienciasIdiomas} onChange={(v) => set({ proficienciasIdiomas: v })} linhas={5} />
              </fieldset>
            </section>
          )}

          {abaAtual === "inventario" && (
            <section className={`${cartao} space-y-4`}>
              <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
                {([["pc", "Cobre"], ["pp", "Prata"], ["pe", "Electro"], ["po", "Ouro"], ["pl", "Platina"]] as const).map(([k, r]) => (
                  <label key={k} className="text-[10px] uppercase tracking-widest text-muted">
                    {r} ({k.toUpperCase()})
                    <Num valor={f.moedas[k]} min={0} onChange={(n) => set({ moedas: { ...f.moedas, [k]: n } })} className="mt-1" />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2 text-xs text-muted">
                <span>Total: <strong className="text-gold">{emOuro(f.moedas).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} po</strong></span>
                <span className="ml-auto flex flex-wrap items-center gap-1">
                  Trocar
                  <input type="number" min={1} value={troca.qtd} onChange={(e) => setTroca({ ...troca, qtd: Math.max(1, Number(e.target.value) || 1) })} aria-label="Quantidade a trocar" className={`${campo} !w-16 !py-0.5 text-center`} />
                  <select value={troca.de} onChange={(e) => setTroca({ ...troca, de: e.target.value as Moeda })} aria-label="Moeda de origem" className={`${campo} !w-auto !py-0.5`}>{(["pc", "pp", "pe", "po", "pl"] as const).map((m) => <option key={m} value={m}>{m}</option>)}</select>
                  por
                  <select value={troca.para} onChange={(e) => setTroca({ ...troca, para: e.target.value as Moeda })} aria-label="Moeda de destino" className={`${campo} !w-auto !py-0.5`}>{(["pc", "pp", "pe", "po", "pl"] as const).map((m) => <option key={m} value={m}>{m}</option>)}</select>
                  <button onClick={() => { const novas = trocarMoedas(f.moedas, troca.de, troca.para, troca.qtd); if (novas === f.moedas) window.alert("Não dá para trocar essa quantidade sem sobrar fração de moeda."); else set({ moedas: novas }); }} className="text-accent-hover hover:underline">trocar</button>
                </span>
              </div>
              {!auto && f.itens.some((i) => i.catalogoId) && <p className="text-xs text-muted">Há itens do catálogo, mas a CA e os ataques das armas só são calculados com a construção pelo livro ativa (aba Personagem).</p>}
              {calc && calc.avisos.length > 0 && (
                <ul className="space-y-0.5 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs">
                  {calc.avisos.map((a) => <li key={a}>⚠ {a}</li>)}
                </ul>
              )}
              <div>
                <h2 className={titulo}>Equipamento e itens</h2>
                {f.itens.length === 0 && <p className="mb-3 text-sm text-muted">Nenhum item cadastrado.</p>}
                <ul className="space-y-2">
                  {f.itens.map((i) => (
                    <li key={i.id} className="rounded-xl border border-border bg-background/50 p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="checkbox" checked={i.equipado} onChange={(e) => setItem(i.id, { equipado: e.target.checked })} aria-label="Equipado" title="Equipado: o item está vestido ou empunhado. Só itens equipados entram no cálculo da CA e dos ataques." />
                        <input value={i.nome} onChange={(e) => setItem(i.id, { nome: e.target.value })} placeholder="Nome do item" className={`${campo} min-w-40 flex-1`} />
                        <label className="flex items-center gap-1 text-xs text-muted">Qtd<Num valor={i.quantidade} min={0} onChange={(n) => setItem(i.id, { quantidade: n })} className="!w-16" /></label>
                        <label className="flex items-center gap-1 text-xs text-muted">Peso (kg)<Num valor={i.peso} min={0} onChange={(n) => setItem(i.id, { peso: n })} className="!w-20" /></label>
                        <label className="flex items-center gap-1 text-xs text-muted" title="Bônus mágico: +N no ataque e dano da arma, ou na CA da armadura/escudo">+<Num valor={i.bonusMagico ?? 0} min={0} onChange={(n) => setItem(i.id, { bonusMagico: n || undefined })} className="!w-14" /></label>
                        <label className="flex items-center gap-1 text-xs text-muted" title="Sintonização: vínculo de um descanso curto com um item mágico para usar seus poderes. Um personagem só pode estar sintonizado com até 3 itens ao mesmo tempo."><input type="checkbox" checked={!!i.sintonizado} onChange={(e) => {
                          if (e.target.checked && papel !== "mestre" && f.itens.filter((x) => x.sintonizado).length >= MAX_SINTONIZADOS) { window.alert(`Só ${MAX_SINTONIZADOS} itens podem estar sintonizados. Desfaça a sintonia de outro antes.`); return; }
                          setItem(i.id, { sintonizado: e.target.checked || undefined });
                        }} /><span className="cursor-help underline decoration-dotted underline-offset-2">sintonizado</span></label>
                        <button onClick={() => set({ itens: f.itens.filter((x) => x.id !== i.id) })} aria-label="Remover item" className="text-muted hover:text-danger"><Trash2 size={15} /></button>
                      </div>
                      <input value={i.descricao} onChange={(e) => setItem(i.id, { descricao: e.target.value })} placeholder="Descrição ou propriedades (opcional)" className={`${campo} mt-2`} />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex gap-4"><button onClick={() => set({ itens: [...f.itens, { id: uid(), nome: "", quantidade: 1, peso: 0, equipado: false, descricao: "" }] })} className="text-accent-hover hover:underline">+ Adicionar item</button>{podeComprar && <button onClick={() => setCatalogoEquip(true)} className="text-accent-hover hover:underline">Comprar no catálogo…</button>}</span>
                  <span className="text-xs text-muted">Peso total: <strong className="text-gold">{pesoTotal(f.itens)} kg</strong>{calc ? ` de ${calc.carga.capacidade} kg` : ""}{calc ? ` · sintonizados ${calc.sintonizados}/${MAX_SINTONIZADOS}` : ""}</span>
                </div>
              </div>
              <Texto rotulo="Anotações sobre o equipamento" valor={f.equipamento} onChange={(v) => set({ equipamento: v })} linhas={4} />
            </section>
          )}

          {abaAtual === "historia" && <LivroHistoria paginas={f.livro} titulo={f.tituloLivro} nomePersonagem={f.nome || nomePadrao} onChange={(livro) => set({ livro })} onTitulo={(tituloLivro) => set({ tituloLivro })} />}

          {abaAtual === "personagem" && (
            <section className={`${cartao} space-y-5`}>
              <fieldset disabled={travada} className="m-0 grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2">
                <Texto rotulo="Traços de personalidade" icone={Theater} dica="Como o personagem age e fala, seus hábitos e manias." valor={f.personalidade} onChange={(v) => set({ personalidade: v })} sugestoes={antecedenteCat?.personalidade?.tracos} />
                <Texto rotulo="Ideais" icone={Scale} dica="Aquilo em que ele acredita e que move suas decisões." valor={f.ideais} onChange={(v) => set({ ideais: v })} sugestoes={antecedenteCat?.personalidade?.ideais} />
                <Texto rotulo="Vínculos" icone={Link2} dica="Pessoas, lugares ou objetos a que ele é ligado." valor={f.vinculos} onChange={(v) => set({ vinculos: v })} sugestoes={antecedenteCat?.personalidade?.vinculos} />
                <Texto rotulo="Defeitos" icone={Skull} dica="Vícios, medos e fraquezas que o colocam em apuros." valor={f.defeitos} onChange={(v) => set({ defeitos: v })} sugestoes={antecedenteCat?.personalidade?.defeitos} />
                <div className="sm:col-span-2"><Texto rotulo="Aparência" icone={Eye} dica="Idade, altura, olhos, cabelo, marcas, trajes…" valor={f.aparencia} onChange={(v) => set({ aparencia: v })} /></div>
              </fieldset>
              <Texto rotulo="Anotações" icone={NotebookPen} dica="Aliados, organizações, pistas e lembretes da campanha. Continua editável com a ficha publicada." valor={f.notas} onChange={(v) => set({ notas: v })} linhas={6} />

              {!travada && <div className="space-y-2 border-t border-gold/20 pt-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => {
                      if (!window.confirm("Refazer o personagem do zero? Ao concluir o assistente, TUDO o que está na ficha (raça, classe, magias, inventário, história, anotações…) é substituído. Se você cancelar o assistente, nada muda.")) return;
                      setRefazer(true); setAssistente("criacao");
                    }}
                    disabled={!catLivro}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-gold/15 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/25 disabled:opacity-50"
                  >
                    <RotateCcw size={14} aria-hidden /> Refazer personagem
                  </button>
                  <span className="text-xs text-muted">Apaga a ficha atual e recomeça pelo assistente de criação.</span>
                </div>
              </div>}
            </section>
          )}
        </div>
      </div>

      {rolando && <PainelRolagem key={rolando.seq} origem={f.nome || nomePadrao || undefined} teste={rolando.t} onFechar={() => setRolando(null)} aoAplicar={rolando.t.cura ? (n) => set(aplicarCura(f, n, pvMaxEf)) : rolando.t.morte ? aplicarMorte : undefined} />}
      {catalogoEquip && catLivro && (
        <CatalogoEquipamento
          cat={catLivro}
          saldo={f.moedas}
          compras={comprasCat}
          proficiencias={calc ? { armas: calc.armas.map((x) => x.nome), armaduras: calc.armaduras.map((x) => x.nome), ferramentas: calc.ferramentas.map((x) => x.nome) } : undefined}
          podePagar={(custo) => totalEmCobre(f.moedas) >= custo}
          onComprar={(novos, custo) => {
            const moedas = custo ? pagar(f.moedas, custo) : f.moedas;
            if (!moedas) return;
            set({ itens: [...f.itens, ...novos], moedas });
            setComprasCat((x) => [...x, { itens: novos, custo }]);
          }}
          onDevolver={(k) => {
            const c = comprasCat[k];
            if (!c) return;
            const ids = new Set(c.itens.map((x) => x.id));
            set({ itens: f.itens.filter((x) => !ids.has(x.id)), moedas: reembolsar(f.moedas, c.custo) });
            setComprasCat((x) => x.filter((_, j) => j !== k));
          }}
          onFechar={() => { setCatalogoEquip(false); setComprasCat([]); }}
        />
      )}
      {compendio && (
        <CompendioMagias
          classeInicial={f.classe}
          circuloMax={ehConjuradora(f.classe) && maiorCirculo(f) > 0 ? maiorCirculo(f) : undefined}
          avaliar={(m) => (papel === "mestre" ? { ok: true } : podeAprender(f, m))}
          jaNaFicha={new Set(f.magias.map((m) => m.catalogoId).filter((x): x is string => !!x))}
          onAdicionar={(m) => {
            const cheio = m.nivel === 0 ? contagemMagias(f).truquesCheio : contagemMagias(f).magiasCheio;
            const nova = magiaParaFicha(m, uid(), !cheio);
            // multiclasse: a magia é conjurada pela primeira classe do personagem que a tem na lista (define o atributo de conjuração)
            const origem = classesDaFicha(f).map((c) => c.id).find((id) => ehConjuradora(id as ClasseId) && m.classes.includes(id));
            set({ magias: [...f.magias, f.classes && f.classes.length > 1 && origem ? { ...nova, classeOrigem: origem } : nova] });
          }}
          onFechar={() => setCompendio(false)}
        />
      )}
      {trocaMagias && <TrocaMagias ficha={f} etapa={trocaMagias} onMudar={salvar} onTrocar={() => setTrocaMagias("trocar")} onFechar={() => setTrocaMagias(null)} />}
    </div>
  );
}
