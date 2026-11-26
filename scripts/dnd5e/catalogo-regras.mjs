// Raças, antecedentes, classes e talentos do Livro do Jogador → JSON do pacote "phb".
// Texto (traços, características, tabelas) é lido dos .md; o que a ficha precisa calcular (bônus de atributo, deslocamento,
// proficiências concedidas, escolhas) é CURADO nas tabelas abaixo e conferido contra o texto pelo próprio script (avisos).
// Chamado por scripts/gerar-catalogo-dnd5e.mjs.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const semAcento = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const ler = (dir, nome) => readFileSync(join(dir, nome), "utf8").replace(/\r\n/g, "\n");

const ATR = { força: "for", destreza: "des", constituição: "con", inteligência: "int", sabedoria: "sab", carisma: "car" };
const ATRS = ["for", "des", "con", "int", "sab", "car"];
const PERICIAS = {
  "acrobacia": "acrobacia", "adestrar animais": "adestrar", "arcanismo": "arcanismo", "atletismo": "atletismo", "atuação": "atuacao",
  "enganação": "enganacao", "furtividade": "furtividade", "história": "historia", "intimidação": "intimidacao", "intuição": "intuicao",
  "investigação": "investigacao", "medicina": "medicina", "natureza": "natureza", "percepção": "percepcao", "persuasão": "persuasao",
  "prestidigitação": "prestidigitacao", "religião": "religiao", "sobrevivência": "sobrevivencia",
};
const periciaId = (nome) => PERICIAS[nome.trim().toLowerCase().replace(/\.$/, "")];
const NUM = { um: 1, uma: 1, dois: 2, duas: 2, três: 3, quatro: 4 };

const somar = (atr) => Object.entries(atr).map(([a, v]) => ({ alvo: `atr.${a}`, op: "somar", valor: v }));
const desloc = (m) => ({ alvo: "deslocamento", op: "definir", valor: m });

/** "**Nome.** texto**Outro.** texto" → [{id,nome,texto}] */
function tracos(texto) {
  const partes = texto.split(/\*\*([^*]+?)\.?\*\*\.?/);
  const out = [];
  for (let i = 1; i < partes.length; i += 2) {
    const nome = partes[i].trim();
    const t = (partes[i + 1] ?? "").trim();
    if (nome && t) out.push({ id: slug(nome), nome, texto: t });
  }
  return out;
}

// ============================ RAÇAS ============================
// `efeitos`: números para o motor. `concede`: proficiências/idiomas/resistências. `escolhas`: decisões do jogador.
const IDIOMA_EXTRA = { id: "idioma", rotulo: "Idioma adicional", tipo: "idioma", qtd: 1 };
const RACAS = {
  "Anão": {
    atr: { con: 2 }, desl: 7.5, tamanho: "Médio",
    concede: { sentidos: ["Visão no Escuro 18 m"], idiomas: ["Comum", "Anão"], armas: ["machado de batalha", "machadinha", "martelo leve", "martelo de guerra"], resistencias: ["veneno"] },
    escolhas: [{ id: "ferramenta", rotulo: "Ferramenta de artesão", tipo: "ferramenta", qtd: 1, opcoes: ["Ferramentas de ferreiro", "Suprimentos de cervejeiro", "Ferramentas de pedreiro"] }],
    subs: {
      "Anão da Colina": { atr: { sab: 1 }, efeitos: [{ alvo: "pv.porNivel", op: "somar", valor: 1 }] },
      "Anão da Montanha": { atr: { for: 2 }, concede: { armaduras: ["leve", "média"] } },
    },
  },
  "Elfo": {
    atr: { des: 2 }, desl: 9, tamanho: "Médio",
    concede: { sentidos: ["Visão no Escuro 18 m"], idiomas: ["Comum", "Élfico"], pericias: ["percepcao"] },
    subs: {
      "Alto Elfo": { atr: { int: 1 }, concede: { armas: ["espada longa", "espada curta", "arco longo", "arco curto"] }, escolhas: [{ id: "truque", rotulo: "Truque de mago", tipo: "truque", qtd: 1, lista: "mago" }, IDIOMA_EXTRA] },
      "Elfo da Floresta": { atr: { sab: 1 }, concede: { armas: ["espada longa", "espada curta", "arco longo", "arco curto"] }, deslocamento: 10.5 },
      "Elfo Negro (Drow)": { atr: { car: 1 }, concede: { armas: ["rapieira", "espada curta", "besta de mão"], sentidos: ["Visão no Escuro Superior 36 m"] }, retira: { sentidos: ["Visão no Escuro 18 m"] } },
    },
  },
  "Halfling": {
    atr: { des: 2 }, desl: 7.5, tamanho: "Pequeno",
    concede: { idiomas: ["Comum", "Halfling"] },
    subs: {
      "Pés Leves": { atr: { car: 1 } },
      "Robusto": { atr: { con: 1 }, concede: { resistencias: ["veneno"] } },
    },
  },
  "Humano": {
    atr: {}, desl: 9, tamanho: "Médio",
    concede: { idiomas: ["Comum"] },
    escolhas: [IDIOMA_EXTRA],
    // padrão: +1 em tudo. Variante (exige a regra opcional de talentos): 2 atributos +1, 1 perícia e 1 talento.
    variantes: {
      padrao: { nome: "Humano padrão", atr: { for: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 } },
      variante: {
        nome: "Humano variante", requer: "talentos", atr: {}, tracosDe: "Traços Raciais Alternativos",
        escolhas: [
          { id: "atributos", rotulo: "Dois atributos (+1)", tipo: "atributo", qtd: 2, valor: 1 },
          { id: "pericia", rotulo: "Perícia", tipo: "pericia", qtd: 1 },
          { id: "talento", rotulo: "Talento", tipo: "talento", qtd: 1 },
        ],
      },
    },
  },
  "Draconato": {
    atr: { for: 2, car: 1 }, desl: 9, tamanho: "Médio",
    concede: { idiomas: ["Comum", "Dracônico"] },
    escolhas: [{
      id: "ancestral", rotulo: "Ancestral dracônico", tipo: "opcao", qtd: 1,
      opcoes: [
        ["Azul", "elétrico", "linha 1,5×9 m (Des)"], ["Branco", "frio", "cone 4,5 m (Con)"], ["Bronze", "elétrico", "linha 1,5×9 m (Des)"],
        ["Cobre", "ácido", "linha 1,5×9 m (Des)"], ["Latão", "fogo", "linha 1,5×9 m (Des)"], ["Negro", "ácido", "linha 1,5×9 m (Des)"],
        ["Ouro", "fogo", "cone 4,5 m (Des)"], ["Prata", "frio", "cone 4,5 m (Con)"], ["Verde", "veneno", "cone 4,5 m (Con)"], ["Vermelho", "fogo", "cone 4,5 m (Des)"],
      ].map(([nome, dano, sopro]) => ({ id: slug(nome), nome: `${nome} (${dano})`, descricao: `Arma de sopro: ${sopro}`, concede: { resistencias: [dano] } })),
    }],
  },
  "Gnomo": {
    atr: { int: 2 }, desl: 7.5, tamanho: "Pequeno",
    concede: { sentidos: ["Visão no Escuro 18 m"], idiomas: ["Comum", "Gnômico"] },
    subs: {
      "Gnomo da Floresta": { atr: { des: 1 } },
      "Gnomo das Rochas": { atr: { con: 1 } },
    },
  },
  "Meio-elfo": {
    atr: { car: 2 }, desl: 9, tamanho: "Médio",
    concede: { sentidos: ["Visão no Escuro 18 m"], idiomas: ["Comum", "Élfico"] },
    escolhas: [
      { id: "atributos", rotulo: "Dois atributos (+1)", tipo: "atributo", qtd: 2, valor: 1, excluir: ["car"] },
      { id: "pericias", rotulo: "Duas perícias", tipo: "pericia", qtd: 2 },
      IDIOMA_EXTRA,
    ],
  },
  "Meio-orc": {
    atr: { for: 2, con: 1 }, desl: 9, tamanho: "Médio",
    concede: { sentidos: ["Visão no Escuro 18 m"], idiomas: ["Comum", "Orc"], pericias: ["intimidacao"] },
  },
  "Tiefling": {
    atr: { int: 1, car: 2 }, desl: 9, tamanho: "Médio",
    concede: { sentidos: ["Visão no Escuro 18 m"], idiomas: ["Comum", "Infernal"], resistencias: ["fogo"] },
    // Legado Ctônico (Livro do Jogador 2024, D&D Beyond). Substitui a Resistência Infernal e a Linhagem Infernal da base:
    // `retira` tira a resistência a fogo que a raça base concede. Os bônus de atributo continuam os da raça base (livro 2014).
    variantes: {
      // Infernal = a própria raça base (Resistência Infernal e Linhagem Infernal do livro 2014); existe como opção para o assistente
      // sempre oferecer a escolha de legado e para a ficha não cair no legado Ctônico por ser a única sub-raça.
      infernal: {
        nome: "Tiefling Infernal", atr: {}, concede: {},
        texto: "**Legado Infernal.** Sem mudanças em relação à raça base: use a Resistência Infernal (resistência a dano de fogo) e a Linhagem Infernal (taumaturgia; no 3º nível repreensão infernal; no 5º escuridão).",
      },
      // Legado Abissal (Livro do Jogador 2024): troca fogo por veneno.
      abyssal: {
        nome: "Tiefling Abissal (Abyssal)", atr: {}, concede: { resistencias: ["veneno"] },
        escolhas: [{ id: "atributo-conjuracao", rotulo: "Habilidade de conjuração do legado", tipo: "opcao", qtd: 1, opcoes: [{ id: "int", nome: "Inteligência" }, { id: "sab", nome: "Sabedoria" }, { id: "car", nome: "Carisma" }] }],
        retira: { resistencias: ["fogo"] },
        texto: [ "**Legado Abissal.** Seu legado vem dos Abismos. Você tem resistência a dano de veneno e conhece o truque rajada de veneno. Ao alcançar o 3º nível de personagem, você aprende a magia raio adoecente e, ao alcançar o 5º nível, a magia imobilizar pessoa: ambas ficam sempre preparadas. Você pode conjurar cada uma uma vez sem gastar espaço de magia e recupera esse uso ao terminar um descanso longo; também pode conjurá-las com espaços de magia do círculo adequado. Inteligência, Sabedoria ou Carisma é sua habilidade de conjuração para essas magias (escolha ao selecionar o legado).",
          "**Presença de Outro Mundo.** Você conhece o truque taumaturgia. Ao conjurá-lo com esta característica, usa a mesma habilidade de conjuração do Legado Abissal.",
        ].join("\n\n"),
      },
      chthonic: {
        nome: "Tiefling Ctônico (Chthonic)", atr: {}, concede: { resistencias: ["necrótico"] },
        escolhas: [{ id: "atributo-conjuracao", rotulo: "Habilidade de conjuração do legado", tipo: "opcao", qtd: 1, opcoes: [{ id: "int", nome: "Inteligência" }, { id: "sab", nome: "Sabedoria" }, { id: "car", nome: "Carisma" }] }],
        retira: { resistencias: ["fogo"] },
        texto: [
          "**Legado Ctônico.** Seu legado vem de Carceri, Gehenna e Hades. Você tem resistência a dano necrótico e conhece o truque toque arrepiante. Ao alcançar o 3º nível de personagem, você aprende a magia vitalidade falsa e, ao alcançar o 5º nível, a magia raio do enfraquecimento: ambas ficam sempre preparadas. Você pode conjurar cada uma uma vez sem gastar espaço de magia e recupera esse uso ao terminar um descanso longo; também pode conjurá-las com espaços de magia do círculo adequado. Inteligência, Sabedoria ou Carisma é sua habilidade de conjuração para essas magias (escolha ao selecionar o legado).",
          "**Presença de Outro Mundo.** Você conhece o truque taumaturgia. Ao conjurá-lo com esta característica, usa a mesma habilidade de conjuração do Legado Ctônico.",
        ].join("\n\n"),
      },
    },
  },
};

function racas(md, avisos) {
  const secoes = md.split(/\n## /).slice(1);
  const out = [];
  for (const sec of secoes) {
    const nome = sec.split("\n")[0].trim();
    const def = RACAS[nome];
    if (!def) continue;
    const iTr = sec.search(/\n### Traços Raciais/);
    if (iTr < 0) { avisos.push(`Raça sem traços: ${nome}`); continue; }
    let corpo = sec.slice(iTr).replace(/^\n### [^\n]*\n/, "");
    const fim = corpo.search(/\n### |\n## /);
    if (fim >= 0) corpo = corpo.slice(0, fim);
    const blocos = corpo.split(/\n#### /);
    const porTitulo = new Map(blocos.slice(1).map((b) => [b.split("\n")[0].trim(), b.split("\n").slice(1).join("\n")]));
    // Os traços ficam no bloco principal e também nos blocos "####" que o livro intercala (ex.: "Desconfiança Recíproca" do
    // Tiefling, "Ancestral Dracônico" do Draconato): de cada bloco que não é sub-raça/variante, vale o texto a partir do
    // primeiro parágrafo que começa com "**Nome.**".
    const titulosSub = new Set([...Object.keys(def.subs ?? {}), ...Object.values(def.variantes ?? {}).map((v) => v.tracosDe).filter(Boolean)]);
    const principais = [
      ...tracos(blocos[0]),
      ...blocos.slice(1).filter((b) => !titulosSub.has(b.split("\n")[0].trim())).flatMap((b) => {
        const m = b.match(/\n\*\*[^*\n]+?\.\*\*/);
        return m ? tracos(b.slice(m.index + 1)) : [];
      }),
    ].filter((t) => !/^sub-racas?$/.test(t.id));

    const mk = (id, nomeSub, d, texto, extra = {}) => ({
      id, nome: nomeSub, pacote: "phb",
      efeitos: [...somar(d.atr ?? {}), ...(d.efeitos ?? []), ...(d.deslocamento ? [desloc(d.deslocamento)] : [])],
      ...(d.concede ? { concede: d.concede } : {}),
      ...(d.escolhas ? { escolhas: d.escolhas } : {}),
      ...(d.retira ? { retira: d.retira } : {}),
      tracos: tracos(texto),
      ...extra,
    });

    const raca = mk(slug(nome), nome, { atr: def.atr, concede: def.concede, escolhas: def.escolhas, efeitos: [desloc(def.desl)] }, blocos[0], { tamanho: def.tamanho, deslocamento: def.desl });
    raca.tracos = principais;

    const subs = [];
    for (const [sn, sd] of Object.entries(def.subs ?? {})) {
      const t = porTitulo.get(sn);
      if (t === undefined) { avisos.push(`Sub-raça sem bloco no livro: ${sn}`); continue; }
      subs.push(mk(slug(sn), sn, sd, t));
    }
    for (const [vid, vd] of Object.entries(def.variantes ?? {})) {
      const t = vd.texto ?? (vd.tracosDe ? porTitulo.get(vd.tracosDe) ?? "" : "");
      if (vd.tracosDe && !t) avisos.push(`Variante sem traços no livro: ${vd.nome}`);
      subs.push(mk(`${slug(nome)}-${vid}`, vd.nome, vd, t, vd.requer ? { requer: vd.requer } : {}));
    }
    if (subs.length) raca.sub = subs;
    out.push(raca);
  }
  const faltam = Object.keys(RACAS).filter((n) => !out.some((r) => r.nome === n));
  if (faltam.length) avisos.push(`Raças não encontradas: ${faltam.join(", ")}`);
  return out;
}

// ============================ ANTECEDENTES ============================
function antecedentes(md, avisos) {
  const resumo = md.split("\n").filter((l) => /^\| [^|]+ \|/.test(l)).slice(2, 15).filter((l) => !/^\| ---/.test(l));
  const linhas = [];
  const iniR = md.indexOf("## Resumo rápido");
  const fimR = md.indexOf("\n---", iniR);
  for (const l of md.slice(iniR, fimR).split("\n")) {
    const c = l.split("|").map((x) => x.trim());
    if (c.length >= 6 && c[1] && c[1] !== "Antecedente" && !/^-+$/.test(c[1])) linhas.push({ nome: c[1], pericias: c[2], ferramentas: c[3], idiomas: c[4], caracteristica: c[5] });
  }
  void resumo;
  const iDesc = md.indexOf("\n# Antecedentes");
  const sec = md.slice(iDesc).split(/\n### /).slice(1);
  const out = [];
  for (const l of linhas) {
    const bloco = sec.find((s) => s.split("\n")[0].trim() === l.nome);
    if (!bloco) { avisos.push(`Antecedente sem descrição: ${l.nome}`); continue; }
    const pericias = l.pericias.split(",").map(periciaId).filter(Boolean);
    if (pericias.length !== 2) avisos.push(`Perícias de ${l.nome}: ${l.pericias}`);

    const ferramentas = [];
    const escolhas = [];
    if (l.ferramentas && l.ferramentas !== "–") {
      for (const item of l.ferramentas.split(/,\s*/)) {
        if (/^(um|uma)\b/i.test(item)) escolhas.push({ id: `ferramenta-${escolhas.length + 1}`, rotulo: item.charAt(0).toUpperCase() + item.slice(1), tipo: "ferramenta", qtd: 1 });
        else ferramentas.push(item.charAt(0).toUpperCase() + item.slice(1));
      }
    }
    const mi = l.idiomas.match(/^(Um|Uma|Dois|Duas)\b/i);
    if (mi) escolhas.push({ id: "idioma", rotulo: "Idioma adicional", tipo: "idioma", qtd: NUM[mi[1].toLowerCase()] });

    const carac = bloco.match(/#### Característica: ([^\n]+)\n\n([\s\S]*?)(?=\n#### |\n### |$)/);
    const equip = bloco.match(/\*\*Equipamento:\*\* ([^\n]+)/)?.[1].trim();
    const tabela = (cab) => {
      const m = bloco.match(new RegExp(`\\| d(?:6|8|10|12) \\| ${cab}[^|]*\\|[^\\n]*\\n\\|[-| ]+\\n((?:\\|[^\\n]*\\n?)+)`));
      if (!m) return [];
      return m[1].split("\n").filter(Boolean).map((r) => r.split("|").map((x) => x.trim())[2]).filter(Boolean);
    };
    const personalidade = { tracos: tabela("Traço de Personalidade"), ideais: tabela("Ideal"), vinculos: tabela("Vínculo"), defeitos: tabela("Defeito") };
    if (personalidade.tracos.length !== 8) avisos.push(`${l.nome}: ${personalidade.tracos.length} traços de personalidade (esperado 8)`);

    out.push({
      id: slug(l.nome), nome: l.nome, pacote: "phb", efeitos: [],
      concede: { pericias, ...(ferramentas.length ? { ferramentas } : {}) },
      ...(escolhas.length ? { escolhas } : {}),
      equipamento: equip ?? "",
      caracteristica: carac ? { nome: carac[1].trim(), texto: carac[2].trim() } : undefined,
      personalidade,
    });
  }
  if (out.length !== 13) avisos.push(`Esperados 13 antecedentes, lidos ${out.length}`);
  return out;
}

// ============================ CLASSES ============================
const CLASSES = {
  "Bárbaro": { id: "barbaro", sub: "Caminho Primitivo", subNivel: 3 },
  "Bardo": { id: "bardo", sub: "Colégios de Bardo", subNivel: 3 },
  "Bruxo": { id: "bruxo", sub: "Patronos Transcendentais", subNivel: 1 },
  "Clérigo": { id: "clerigo", sub: "Domínios Divinos", subNivel: 1 },
  "Druida": { id: "druida", sub: "Círculos Druídicos", subNivel: 2 },
  "Feiticeiro": { id: "feiticeiro", sub: "Origens de Feitiçaria", subNivel: 1 },
  "Guerreiro": { id: "guerreiro", sub: "Arquétipos Marciais", subNivel: 3 },
  "Ladino": { id: "ladino", sub: "Arquétipos de Ladino", subNivel: 3 },
  "Mago": { id: "mago", sub: "Tradições Arcanas", subNivel: 2 },
  "Monge": { id: "monge", sub: "Tradições Monásticas", subNivel: 3 },
  "Paladino": { id: "paladino", sub: "Juramentos Sagrados", subNivel: 3 },
  "Patrulheiro": { id: "patrulheiro", sub: "Conclaves de Patrulheiro", subNivel: 3 },
};

const lista = (t) => t.split(/,\s*| e /).map((x) => x.trim().replace(/\.$/, "")).filter(Boolean);

function nomesDaTabela(celula) {
  // a conversão do PDF mistura o número de outras colunas no texto ("Defesa sem 2 Armadura"): remove números soltos
  return celula
    .replace(/\((?:[^)]*)\)/g, (m) => m.replace(/,/g, "·"))
    .split(/,\s*/)
    .map((n) => n.replace(/^\d+\s+/, "").replace(/\s+\d+(?=\s|$)/g, "").replace(/(?<=\s)\d+\s+/g, "").replace(/·/g, ",").trim())
    .filter((n) => n && n !== "–" && !/^[\d\s+d/–-]+$/.test(n));
}

// Subclasses do Guia do Mestre (docs/referencias/master_guide/dnd5e-classes-vilanescas.md): cada bloco "# Classe: Nome" vira
// uma subclasse da classe correspondente e cada "## Título" vira uma característica. A introdução do bloco (requisitos do
// Quebrador de Juramento, descrição do Domínio da Morte) entra como a primeira característica. São opções que o livro
// só libera com aprovação do Mestre; o catálogo as oferece como as demais subclasses.
const SUBS_GUIA_MESTRE = {
  "Paladino": { classe: "paladino", intro: "Tornando-se Quebrador de Juramento" },
  "Clérigo": { classe: "clerigo", intro: "Domínio da Morte (Guia do Mestre)" },
};

function subclassesGuiaMestre(md, avisos) {
  const out = [];
  const limpa = (t) => t.replace(/\n---\s*$/, "").trim();
  for (const bloco of md.split(/\n# /).slice(1)) {
    const [cab, ...resto] = bloco.split("\n");
    const m = cab.match(/^([^:]+):\s*(.+)$/);
    const def = m && SUBS_GUIA_MESTRE[m[1].trim()];
    if (!def) continue;
    const partes = resto.join("\n").split(/\n## /);
    const intro = limpa(partes[0]);
    const caracteristicas = partes.slice(1).map((p) => {
      const nome = p.split("\n")[0].trim();
      return { id: slug(nome), nome, texto: limpa(p.split("\n").slice(1).join("\n")) };
    });
    if (!caracteristicas.length) { avisos.push(`Guia do Mestre: ${m[2]} sem características`); continue; }
    if (intro) caracteristicas.unshift({ id: slug(def.intro), nome: def.intro, texto: intro });
    out.push({ classe: def.classe, sub: { id: slug(m[2]), nome: m[2].trim(), pacote: "dmg", caracteristicas } });
  }
  if (out.length !== 2) avisos.push(`Guia do Mestre: esperadas 2 subclasses, lidas ${out.length}`);
  return out;
}

function classes(md, avisos, extras = []) {
  const secoes = md.split(/\n## /).slice(1);
  const out = [];
  for (const sec of secoes) {
    const nome = sec.split("\n")[0].trim();
    const def = CLASSES[nome];
    if (!def) continue;

    // tabela de progressão (a coluna "Características" varia de posição: lida pelo cabeçalho)
    const tabela = [];
    const linhasSec = sec.split("\n");
    const iCab = linhasSec.findIndex((l) => l.startsWith("| Nível | Bônus de Proficiência"));
    const colCar = iCab < 0 ? 3 : linhasSec[iCab].split("|").map((x) => x.trim()).indexOf("Características");
    for (const l of iCab < 0 ? [] : linhasSec.slice(iCab + 2)) {
      if (!l.startsWith("|")) break;
      const c = l.split("|").map((x) => x.trim());
      const m = c[1]?.match(/^(\d+)°$/);
      if (m && c[2]?.match(/^\+\d$/)) tabela.push({ nivel: Number(m[1]), proficiencia: Number(c[2].slice(1)), caracteristicas: nomesDaTabela(c[colCar] ?? "") });
    }
    // erro conhecido da fonte: a tabela do bruxo perde a linha do 20º nível (Mestre Místico, proficiência +6)
    if (def.id === "bruxo" && !tabela.some((t) => t.nivel === 20)) tabela.push({ nivel: 20, proficiencia: 6, caracteristicas: ["Mestre Místico"] });
    if (tabela.length !== 20) avisos.push(`${nome}: tabela com ${tabela.length} níveis`);

    // características de classe
    const iCar = sec.indexOf("\n### Características de Classe");
    const iSub = sec.indexOf(`\n### ${def.sub}`);
    if (iCar < 0 || iSub < 0) { avisos.push(`${nome}: seção de características ou subclasses não encontrada`); continue; }
    const blocoCar = sec.slice(iCar, iSub);
    // seções ### entre as características e as subclasses (ex.: Invocações) ficam como características de texto
    const antesSub = sec.slice(0, iSub);
    const campo = (rot) => antesSub.match(new RegExp(`\\*\\*${rot}:\\*\\* ([^*\\n]+)`))?.[1].trim() ?? "";
    const dv = Number(antesSub.match(/\*\*Dado de Vida:\*\* 1d(\d+)/)?.[1]);
    const salv = lista(campo("Testes de Resistência")).map((a) => ATR[a.toLowerCase()]).filter(Boolean);
    const perTxt = campo("Perícias");
    const perMatch = perTxt.match(/Escolha (?:quaisquer )?([\p{L}]+)(?: quaisquer)?(?: dentre (.+))?$/iu);
    const qtd = NUM[perMatch?.[1]?.toLowerCase()] ?? 2;
    const opcoes = perMatch?.[2] ? lista(perMatch[2]).map(periciaId).filter(Boolean) : undefined;
    if (opcoes && opcoes.length < 3) avisos.push(`${nome}: perícias lidas: ${perTxt}`);

    const caracteristicas = [];
    for (const m of blocoCar.matchAll(/\n#### ([^\n]+)\n\n([\s\S]*?)(?=\n#### |\n### |$)/g)) {
      const n = m[1].trim();
      if (["Criando um", "Construção Rápida"].some((p) => n.startsWith(p))) continue;
      caracteristicas.push({ id: slug(n), nome: n, texto: m[2].trim() });
    }
    // liga cada item da tabela a uma característica (por id, ou pelo maior id que seja prefixo: "Fúria (3)" → "furia")
    const semDe = (k) => k.split("-").filter((w) => !["de", "da", "do", "das", "dos"].includes(w)).join("-");
    const ids = caracteristicas.map((c) => c.id);
    const porNorm = new Map(caracteristicas.map((c) => [semDe(c.id), c.id]));
    const resolver = (n) => {
      const k = semDe(slug(n));
      const normIds = [...porNorm.keys()];
      if (porNorm.has(k)) return porNorm.get(k);
      const pref = normIds.filter((i) => k.startsWith(i + "-")).sort((a, b) => b.length - a.length)[0];
      if (pref) return porNorm.get(pref);
      const inv = normIds.filter((i) => i.startsWith(k + "-")).sort((a, b) => a.length - b.length)[0];
      return inv ? porNorm.get(inv) : undefined;
    };
    const semLink = [];
    for (const t of tabela) {
      t.caracteristicas = t.caracteristicas.map((n) => {
        const ref = resolver(n);
        const generica = /^(incremento no valor|característica d|habilidade de colégio|aprimoramento)/i.test(n);
        if (!ref && !generica) semLink.push(`${t.nivel}º ${n}`);
        return ref ? { nome: n, ref } : { nome: n };
      });
    }
    for (const c of caracteristicas) {
      const t = tabela.find((x) => x.caracteristicas.some((i) => i.ref === c.id));
      if (t) c.nivel = t.nivel;
    }
    if (semLink.length) avisos.push(`${nome}: itens da tabela sem texto: ${semLink.join("; ")}`);

    // subclasses
    let blocoSub = sec.slice(iSub).replace(/^\n### [^\n]*\n/, "");
    const fimSub = blocoSub.search(/\n### /);
    if (fimSub >= 0) blocoSub = blocoSub.slice(0, fimSub);
    const subclasses = [];
    for (const b of blocoSub.split(/\n#### /).slice(1)) {
      const sn = b.split("\n")[0].trim();
      const feats = [...b.matchAll(/\n##### ([^\n]+)\n\n([\s\S]*?)(?=\n##### |$)/g)].map((m) => ({ id: slug(m[1]), nome: m[1].trim(), texto: m[2].trim() }));
      if (!feats.length) continue;
      subclasses.push({ id: slug(sn), nome: sn, pacote: "phb", caracteristicas: feats });
    }
    if (!subclasses.length) avisos.push(`${nome}: nenhuma subclasse lida`);
    for (const e of extras) if (e.classe === def.id) subclasses.push(e.sub);

    out.push({
      id: def.id, nome, pacote: "phb",
      dadoVida: dv, salvaguardas: salv,
      pericias: { qtd, ...(opcoes ? { opcoes } : {}) },
      armaduras: campo("Armaduras"), armas: campo("Armas"), ferramentas: campo("Ferramentas"),
      subclasseRotulo: def.sub, subclasseNivel: def.subNivel,
      tabela, caracteristicas, subclasses,
    });
  }
  if (out.length !== 12) avisos.push(`Esperadas 12 classes, lidas ${out.length}`);
  return out;
}

// ============================ TALENTOS ============================
const ARMADURA_TALENTO = { "protecao-leve": ["leve"], "protecao-moderada": ["média", "escudo"], "protecao-pesada": ["pesada"] };
const EFEITOS_TALENTO = {
  alerta: [{ alvo: "iniciativa", op: "somar", valor: 5 }],
  robusto: [{ alvo: "pv.porNivel", op: "somar", valor: 2 }],
  mobilidade: [{ alvo: "deslocamento", op: "somar", valor: 3 }],
};

function talentos(md, avisos) {
  const iniT = md.indexOf("\n### Adepto Elemental");
  const out = [];
  for (const b of md.slice(iniT).split(/\n### /).slice(1)) {
    const nome = b.split("\n")[0].trim();
    if (!nome) continue;
    let texto = b.split("\n").slice(1).join("\n").trim();
    const pre = texto.match(/^_Pré-requisito: ([^_]+)_\s*/);
    if (pre) texto = texto.slice(pre[0].length);
    const id = slug(nome);

    const efeitos = [...(EFEITOS_TALENTO[id] ?? [])];
    const escolhas = [];
    const asi = texto.match(/Aumente (?:seu|o) valor de (?:habilidade )?([^\n]*?) em 1/i);
    if (asi) {
      const t = asi[1].toLowerCase();
      const atrs = ATRS.filter((a) => Object.entries(ATR).some(([n, c]) => c === a && t.includes(n)));
      if (/escolhido/.test(t) || (!atrs.length)) escolhas.push({ id: "atributo", rotulo: "Atributo (+1)", tipo: "atributo", qtd: 1, valor: 1 });
      else if (atrs.length === 1) efeitos.push({ alvo: `atr.${atrs[0]}`, op: "somar", valor: 1 });
      else escolhas.push({ id: "atributo", rotulo: "Atributo (+1)", tipo: "atributo", qtd: 1, valor: 1, opcoes: atrs });
    } else if (/Aumente o valor de habilidade escolhido em 1/i.test(texto)) {
      escolhas.push({ id: "atributo", rotulo: "Atributo (+1)", tipo: "atributo", qtd: 1, valor: 1 });
    }
    if (id === "perito") escolhas.push({ id: "pericias", rotulo: "Três perícias", tipo: "pericia", qtd: 3 });
    if (id === "poliglota") escolhas.push({ id: "idiomas", rotulo: "Três idiomas", tipo: "idioma", qtd: 3 });

    out.push({
      id, nome, pacote: "phb", ...(pre ? { prerequisito: pre[1].trim() } : {}), efeitos,
      ...(ARMADURA_TALENTO[id] ? { concede: { armaduras: ARMADURA_TALENTO[id] } } : {}),
      ...(escolhas.length ? { escolhas } : {}),
      texto,
    });
  }
  if (out.length !== 42) avisos.push(`Esperados 42 talentos, lidos ${out.length}`);
  return out;
}

// ============================ MULTICLASSE ============================
// Tabela de espaços por nível de conjurador (multiclasse) e pré-requisitos, lidos do livro.
function multiclasse(md, avisos) {
  const espacos = [];
  const i = md.indexOf("#### Multiclasse para Conjurador: Espaço de Magia por Nível de Magia");
  for (const l of md.slice(i, i + 3000).split("\n")) {
    const c = l.split("|").map((x) => x.trim());
    const m = c[1]?.match(/^(\d+)°$/);
    if (m && espacos.length < 20) espacos.push({ nivel: Number(m[1]), espacos: c.slice(2, 11).map((x) => (x === "–" ? 0 : Number(x) || 0)) });
  }
  if (espacos.length !== 20) avisos.push(`Tabela de espaços multiclasse com ${espacos.length} linhas`);

  const pre = [];
  const j = md.indexOf("#### Pré-requisitos de Multiclasse");
  for (const l of md.slice(j, j + 1500).split("\n")) {
    const c = l.split("|").map((x) => x.trim());
    if (c.length > 3 && c[1] && !/^(Classe|-+)$/.test(c[1])) pre.push({ classe: c[1], requisito: c[2] });
  }
  if (pre.length !== 12) avisos.push(`Pré-requisitos de multiclasse: ${pre.length} linhas (esperado 12)`);
  return { espacosConjurador: espacos, prerequisitos: pre };
}

export function gerarRegras(dirFonte) {
  const avisos = [];
  return {
    racas: racas(ler(dirFonte, "dnd5e-racas.md"), avisos),
    antecedentes: antecedentes(ler(dirFonte, "dnd5e-antecedentes.md"), avisos),
    classes: classes(ler(dirFonte, "dnd5e-classes.md"), avisos, subclassesGuiaMestre(ler(join(dirFonte, "../master_guide"), "dnd5e-classes-vilanescas.md"), avisos)),
    talentos: talentos(ler(dirFonte, "dnd5e-talentos-multiclasse.md"), avisos),
    multiclasse: multiclasse(ler(dirFonte, "dnd5e-talentos-multiclasse.md"), avisos),
    avisos,
  };
}
