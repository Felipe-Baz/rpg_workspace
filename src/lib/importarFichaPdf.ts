// Importa a ficha oficial "D&D 5ed - Ficha Editável.pdf" (formulário PDF preenchido) para o modelo `FichaDnd`.
// O PDF não nomeia os campos ("Campo de Texto12", "Caixa de Seleção5"): o mapa abaixo foi levantado pela posição
// de cada campo na página. Chaves: `t<N>` = campo de texto, `c<N>` = caixa de seleção.
// A leitura do arquivo (pdf-lib) fica em `lerCamposPdf`; `fichaDeCampos` é puro e testável.

import {
  ATRIBUTOS, FICHA_VAZIA, PERICIAS, bonusProficiencia, modificador, normalizar,
  type Ataque, type Atributo, type FichaDnd, type Magia, type PericiaId,
} from "./dnd5e.ts";

export type CamposPdf = Record<string, string | boolean>;

// ---------- mapa de campos ----------
const ATRIBUTO_CAMPOS: Record<Atributo, { mod: string; valor: string }> = {
  for: { mod: "t27", valor: "t29" }, des: { mod: "t30", valor: "t33" }, con: { mod: "t32", valor: "t31" },
  int: { mod: "t35", valor: "t34" }, sab: { mod: "t36", valor: "t39" }, car: { mod: "t38", valor: "t37" },
};
const SALVAGUARDA_CHECK: Record<Atributo, string> = { for: "c0", des: "c1", con: "c2", int: "c3", sab: "c4", car: "c5" };

/** Perícias na ordem em que aparecem na ficha (de cima para baixo): caixa `c6`.., valor `t66`.. */
const PERICIAS_PDF: PericiaId[] = [
  "acrobacia", "arcanismo", "atletismo", "atuacao", "enganacao", "furtividade", "historia", "intimidacao", "intuicao",
  "investigacao", "adestrar", "medicina", "natureza", "percepcao", "persuasao", "prestidigitacao", "religiao", "sobrevivencia",
];

const ATAQUES_PDF = [{ nome: "t45", bonus: "t48", dano: "t51" }, { nome: "t46", bonus: "t49", dano: "t52" }, { nome: "t47", bonus: "t50", dano: "t53" }];
const MOEDAS_PDF = { pc: "t55", pp: "t57", pe: "t58", po: "t59", pl: "t56" } as const;

/** Espaços de magia: [total, usados] do 1º ao 9º círculo. */
const ESPACOS_PDF: [string, string][] = [
  ["t104", "t103"], ["t105", "t102"], ["t92", "t91"], ["t97", "t98"], ["t106", "t99"], ["t93", "t94"], ["t95", "t96"], ["t108", "t101"], ["t107", "t100"],
];

/** Linhas de magia por círculo (0 = truques): [campo do nome, caixa "preparada"]. */
const LINHAS_MAGIA: [texto: number, preparada: number | null][][] = [
  [[134, null], [135, null], [136, null], [137, null], [138, null], [139, null], [140, null], [141, null]],
  [[109, 53], [110, 54], [111, 33], [112, 34], [113, 35], [114, 36], [115, 37], [116, 38], [117, 39], [118, 40], [119, 41], [120, 42]],
  [[121, 49], [122, 48], [123, 47], [124, 46], [125, 45], [126, 44], [127, 43], [128, 32], [129, 31], [130, 30], [131, 50], [132, 51], [133, 52]],
  [[208, 110], [207, 111], [206, 112], [205, 113], [204, 114], [203, 115], [202, 116], [201, 117], [200, 118], [199, 119], [198, 120], [197, 121], [196, 122]],
  [[195, 97], [194, 98], [193, 99], [192, 100], [191, 101], [190, 102], [189, 103], [188, 104], [187, 105], [186, 106], [185, 107], [184, 108], [183, 109]],
  [[182, 74], [181, 73], [180, 61], [179, 60], [178, 59], [177, 72], [176, 71], [175, 70], [174, 69]],
  [[173, 88], [172, 89], [171, 90], [170, 91], [169, 92], [168, 93], [167, 94], [166, 95], [165, 96]],
  [[164, 79], [163, 80], [162, 81], [161, 82], [160, 83], [159, 84], [158, 85], [157, 86], [156, 87]],
  [[155, 56], [154, 57], [153, 58], [152, 75], [151, 76], [150, 77], [149, 78]],
  [[148, 62], [147, 63], [146, 64], [145, 65], [144, 66], [143, 67], [142, 68]],
];

// ---------- leitura de valores ----------
const texto = (c: CamposPdf, k: string): string => {
  const v = c[k];
  return typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "";
};
const marcado = (c: CamposPdf, k: string) => c[k] === true;

/** Primeiro inteiro do texto ("+3", "−1", "12 (corpo a corpo)"); `undefined` se não houver. */
export function inteiro(s: string): number | undefined {
  const m = s.replace(/[−–]/g, "-").match(/([+-])?\s*(\d+)/);
  if (!m) return undefined;
  const n = Number(m[2]);
  return m[1] === "-" ? -n : n;
}

const temSinal = (s: string) => /^\s*[+\-−–]/.test(s);

/** Valor do atributo a partir da caixa grande (modificador) e do oval (valor); aceita preenchimento invertido. */
export function lerAtributo(grande: string, oval: string): number | undefined {
  const g = inteiro(grande), o = inteiro(oval);
  const comoValor = (n: number) => Math.min(30, Math.max(1, n));
  if (g === undefined && o === undefined) return undefined;
  if (o === undefined) return temSinal(grande) || g! < 8 ? comoValor(10 + 2 * g!) : comoValor(g!);
  if (g === undefined) return temSinal(oval) ? comoValor(10 + 2 * o) : comoValor(o);
  if (temSinal(grande) && !temSinal(oval)) return comoValor(o);
  if (temSinal(oval) && !temSinal(grande)) return comoValor(g);
  return comoValor(Math.max(g, o)); // ambos sem sinal: o maior é o valor, o menor é o modificador
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function lerAtributoConjuracao(s: string): Atributo | "" {
  const p = semAcento(s).replace(/[^a-z]/g, "").slice(0, 3);
  const mapa: Record<string, Atributo> = { for: "for", des: "des", dex: "des", con: "con", int: "int", sab: "sab", wis: "sab", car: "car", cha: "car" };
  return mapa[p] ?? "";
}

/** "Mago 5" → { classe: "Mago", nivel: 5 }; várias classes ("Guerreiro 3 / Ladino 2") somam os níveis. */
export function lerClasseNivel(s: string): { classe: string; nivel: number } {
  const numeros = [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));
  const nivel = Math.min(20, Math.max(1, numeros.reduce((a, b) => a + b, 0) || 1));
  if (numeros.length !== 1) return { classe: s, nivel };
  const classe = s.replace(/\b(n[ií]vel|nv|lvl|level)\b\.?/gi, "").replace(/\d+/g, "").replace(/^[\s,/\-–]+|[\s,/\-–]+$/g, "").trim();
  return { classe, nivel };
}

function lerAtaque(nome: string, bonus: string, danoTipo: string, f: FichaDnd, id: string): Ataque {
  const total = inteiro(bonus);
  // escolhe força/destreza e proficiência que deixam o bônus extra o menor possível
  let atr: Atributo = "for", proficiente = true, extra = 0;
  if (total !== undefined) {
    let melhor = Infinity;
    for (const a of ["for", "des"] as const) for (const p of [true, false]) {
      const e = total - modificador(f.atributos[a]) - (p ? bonusProficiencia(f.nivel) : 0);
      if (Math.abs(e) < melhor) { melhor = Math.abs(e); atr = a; proficiente = p; extra = e; }
    }
  }
  const dado = danoTipo.match(/\d*\s*d\s*\d+/i);
  const resto = dado ? danoTipo.replace(dado[0], " ") : danoTipo;
  const fixo = resto.replace(/[−–]/g, "-").match(/([+-])\s*(\d+)/);
  const valorFixo = fixo ? (fixo[1] === "-" ? -1 : 1) * Number(fixo[2]) : undefined;
  const tipoDano = resto.replace(fixo?.[0] ?? "", " ").replace(/[^\p{L}\s/,-]/gu, " ").replace(/\s+/g, " ").trim();
  return {
    id, nome, atr, proficiente, bonusAtaque: extra,
    dano: dado ? dado[0].replace(/\s+/g, "") : "",
    bonusDano: valorFixo !== undefined ? valorFixo - modificador(f.atributos[atr]) : 0,
    tipoDano, notas: "",
  };
}

const junta = (...partes: string[]) => partes.filter(Boolean).join("\n\n");

export type ResultadoImportacao = { ficha: FichaDnd; resumo: string };

/** Converte os campos do PDF numa ficha completa. `novoId` gera ids de ataques e magias. */
export function fichaDeCampos(c: CamposPdf, novoId: () => string, base?: Partial<FichaDnd>): ResultadoImportacao {
  // `normalizar({})` devolve arrays/objetos novos; partir de FICHA_VAZIA mutaria o modelo compartilhado.
  const f: FichaDnd = normalizar({ tituloLivro: base?.tituloLivro ?? "" });

  // identificação
  f.nome = texto(c, "t0") || texto(c, "t84");
  const cn = lerClasseNivel(texto(c, "t8"));
  f.classe = cn.classe; f.nivel = cn.nivel;
  f.antecedente = texto(c, "t9"); f.raca = texto(c, "t13"); f.alinhamento = texto(c, "t12");
  f.xp = Math.max(0, inteiro(texto(c, "t11")) ?? 0);
  const insp = texto(c, "t26").toLowerCase();
  f.inspiracao = insp !== "" && !/^(0|n[aã]o|nao|-|—)$/.test(insp);

  // atributos, salvaguardas, perícias
  for (const a of ATRIBUTOS) {
    const campos = ATRIBUTO_CAMPOS[a];
    f.atributos[a] = lerAtributo(texto(c, campos.mod), texto(c, campos.valor)) ?? 10;
    f.salvaguardas[a] = marcado(c, SALVAGUARDA_CHECK[a]);
  }
  const bp = bonusProficiencia(f.nivel);
  PERICIAS_PDF.forEach((id, i) => {
    const def = PERICIAS.find((p) => p.id === id)!;
    const proficiente = marcado(c, `c${6 + i}`);
    const valor = inteiro(texto(c, `t${66 + i}`));
    const mod = modificador(f.atributos[def.atr]);
    if (valor !== undefined && proficiente && valor === mod + 2 * bp) f.pericias[id] = 2; // especialização
    else {
      if (proficiente) f.pericias[id] = 1;
      const extra = valor === undefined ? 0 : valor - mod - (proficiente ? bp : 0);
      if (extra !== 0) f.bonusPericias[id] = extra;
    }
  });

  // combate
  f.ca = inteiro(texto(c, "t25")) ?? 10;
  const ini = inteiro(texto(c, "t23"));
  f.bonusIniciativa = ini === undefined ? 0 : ini - modificador(f.atributos.des);
  f.deslocamento = texto(c, "t24") || FICHA_VAZIA.deslocamento;
  f.pvMax = Math.max(1, inteiro(texto(c, "t42")) ?? FICHA_VAZIA.pvMax);
  f.pv = Math.min(f.pvMax, Math.max(0, inteiro(texto(c, "t40")) ?? f.pvMax));
  f.pvTemp = Math.max(0, inteiro(texto(c, "t41")) ?? 0);
  const dv = texto(c, "t43");
  const faces = dv.match(/d\s*(\d+)/i);
  f.dadoVida = faces ? `d${faces[1]}` : FICHA_VAZIA.dadoVida;
  const quantidade = inteiro(texto(c, "t44")) ?? (dv.match(/^\s*(\d+)\s*d/i) ? Number(dv.match(/^\s*(\d+)\s*d/i)![1]) : f.nivel);
  f.dadosVidaTotal = Math.max(1, quantidade);
  f.morteSucessos = [24, 25, 26].filter((n) => marcado(c, `c${n}`)).length;
  f.morteFalhas = [27, 28, 29].filter((n) => marcado(c, `c${n}`)).length;

  f.ataques = ATAQUES_PDF
    .map((a) => ({ nome: texto(c, a.nome), bonus: texto(c, a.bonus), dano: texto(c, a.dano) }))
    .filter((a) => a.nome || a.bonus || a.dano)
    .map((a) => lerAtaque(a.nome, a.bonus, a.dano, f, novoId()));

  // magias
  f.atrConjuracao = lerAtributoConjuracao(texto(c, "t20"));
  ESPACOS_PDF.forEach(([total, usados], i) => {
    const t = Math.min(9, Math.max(0, inteiro(texto(c, total)) ?? 0));
    f.espacos[i] = { total: t, usados: Math.min(t, Math.max(0, inteiro(texto(c, usados)) ?? 0)) };
  });
  LINHAS_MAGIA.forEach((linhas, nivel) => {
    for (const [t, p] of linhas) {
      const nome = texto(c, `t${t}`);
      if (!nome) continue;
      const m: Magia = {
        id: novoId(), nome, nivel, preparada: nivel === 0 || (p !== null && marcado(c, `c${p}`)),
        escola: "", tempo: "1 ação", alcance: "", componentes: "", duracao: "", descricao: "", tipo: "nenhum", dano: "", salvaguarda: "des",
      };
      f.magias.push(m);
    }
  });

  // equipamento, traços e personagem
  for (const k of Object.keys(MOEDAS_PDF) as (keyof typeof MOEDAS_PDF)[]) f.moedas[k] = Math.max(0, inteiro(texto(c, MOEDAS_PDF[k])) ?? 0);
  const tesouros = texto(c, "t16");
  f.equipamento = junta(texto(c, "t6"), tesouros && `Tesouros:\n${tesouros}`);
  f.tracos = junta(texto(c, "t14"), texto(c, "t15"));
  f.proficienciasIdiomas = texto(c, "t7");
  f.personalidade = texto(c, "t1"); f.ideais = texto(c, "t2"); f.vinculos = texto(c, "t3"); f.defeitos = texto(c, "t4");
  const fisico = [["Idade", "t85"], ["Altura", "t86"], ["Peso", "t87"], ["Cabelo", "t88"], ["Pele", "t89"], ["Olhos", "t90"]]
    .map(([r, k]) => (texto(c, k) ? `${r}: ${texto(c, k)}` : "")).filter(Boolean);
  f.aparencia = fisico.join(" · ");
  f.livro = [texto(c, "t17")];
  const org = texto(c, "t18"), aliados = texto(c, "t209");
  f.notas = junta(texto(c, "t5") && `Ataques e conjuração (anotações):\n${texto(c, "t5")}`, (org || aliados) && `Aliados e organizações${org ? ` (${org})` : ""}:\n${aliados}`.trim());

  const resumo = `${f.nome || "Personagem sem nome"}${f.classe ? `, ${f.classe}` : ""} nível ${f.nivel}: ${f.ataques.length} ataque(s), ${f.magias.length} magia(s).`;
  return { ficha: f, resumo };
}

/** Lê os campos do formulário PDF. Lança `Error` com mensagem para o usuário se não for a ficha. */
export async function lerCamposPdf(dados: ArrayBuffer): Promise<CamposPdf> {
  const { PDFDocument, PDFTextField, PDFCheckBox } = await import("pdf-lib");
  let doc;
  try { doc = await PDFDocument.load(dados, { ignoreEncryption: true }); }
  catch { throw new Error("Não consegui abrir esse arquivo como PDF."); }
  const campos: CamposPdf = {};
  const campo = doc.getForm().getFields();
  for (const fld of campo) {
    const n = fld.getName().match(/(\d+)$/)?.[1];
    if (!n) continue;
    if (fld instanceof PDFTextField) campos[`t${n}`] = fld.getText() ?? "";
    else if (fld instanceof PDFCheckBox) campos[`c${n}`] = fld.isChecked();
  }
  if (campo.length < 200 || !("t0" in campos) || !("t209" in campos)) {
    throw new Error("Esse PDF não parece ser a ficha “D&D 5ed - Ficha Editável” (formulário preenchível).");
  }
  return campos;
}
