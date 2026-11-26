// Gera src/lib/regras/dnd5e/opcoesClasse.ts: as opções de Metamágica, Manobras e Disciplinas Elementais lidas do texto
// do catálogo (classes.json), para o assistente oferecê-las como escolhas. Rodar à mão depois de gerar o catálogo.
import { readFileSync, writeFileSync } from "node:fs";

const classes = JSON.parse(readFileSync(new URL("../../src/data/dnd5e/phb/classes.json", import.meta.url), "utf8"));
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const feiticeiro = classes.find((c) => c.id === "feiticeiro");
const mestre = classes.find((c) => c.id === "guerreiro").subclasses.find((s) => s.id === "mestre-de-batalha");
const elementos = classes.find((c) => c.id === "monge").subclasses.find((s) => s.id === "caminho-dos-quatro-elementos");

const metamagia = [...feiticeiro.caracteristicas.find((f) => f.id === "metamagica").texto.matchAll(/##### ([^\n]+)\n\n([\s\S]*?)(?=\n##### |$)/g)]
  .map((m) => ({ id: slug(m[1]), nome: m[1].trim(), texto: m[2].trim() }));

const porNegrito = (texto) => {
  const partes = texto.split(/\*\*([^*]+?)\.?\*\*\.?/);
  const out = [];
  for (let i = 1; i < partes.length; i += 2) out.push({ nome: partes[i].trim(), texto: (partes[i + 1] ?? "").trim() });
  return out;
};
const manobras = porNegrito(mestre.caracteristicas.find((f) => f.id === "manobras").texto).map((x) => ({ id: slug(x.nome), nome: x.nome, texto: x.texto }));
const disciplinas = porNegrito(elementos.caracteristicas.find((f) => f.id === "disciplinas-elementais").texto).filter((x) => x.texto).map((x) => {
  const m = x.nome.match(/^(.*?)\s*\((\d+)° nível Requerido\)$/);
  return { id: slug(m ? m[1] : x.nome), nome: m ? m[1] : x.nome, nivel: m ? Number(m[2]) : 1, texto: x.texto };
});
if (metamagia.length !== 8 || manobras.length !== 16 || disciplinas.length < 15) throw new Error(`contagem inesperada: ${metamagia.length}/${manobras.length}/${disciplinas.length}`);

const ts = `// GERADO por scripts/dnd5e/gerar-opcoes-classe.mjs a partir de classes.json. Não editar à mão.
export type OpcaoTexto = { id: string; nome: string; texto: string; nivel?: number };
export const METAMAGIAS: OpcaoTexto[] = ${JSON.stringify(metamagia, null, 2)};
export const MANOBRAS: OpcaoTexto[] = ${JSON.stringify(manobras, null, 2)};
export const DISCIPLINAS_ELEMENTAIS: OpcaoTexto[] = ${JSON.stringify(disciplinas, null, 2)};
`;
writeFileSync(new URL("../../src/lib/regras/dnd5e/opcoesClasse.ts", import.meta.url), ts);
console.log(metamagia.length, "metamágicas,", manobras.length, "manobras,", disciplinas.length, "disciplinas");
