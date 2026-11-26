// Gera src/data/dnd5e/phb/invocacoes.json (Invocações Místicas do bruxo) a partir do capítulo de classes do Livro do
// Jogador em docs/referencias/playerbook/dnd5e-classes.md. Rodar à mão: `node scripts/dnd5e/gerar-invocacoes.mjs`.
// O texto é lido do livro; os pré-requisitos viram dados (`requisitos`) e o que a ficha calcula de cada invocação
// (CA, perícias, usos) fica curado em src/lib/regras/dnd5e/invocacoes.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ENTRADA = join(RAIZ, "docs/referencias/playerbook/dnd5e-classes.md");
const SAIDA = join(RAIZ, "src/data/dnd5e/phb/invocacoes.json");

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const PACTOS = { "pacto da lâmina": "lamina", "pacto do tomo": "tomo", "pacto da corrente": "corrente" };
// o livro escreve "característica Corrente de Cárceri" (erro de tradução): o pré-requisito é o Pacto da Corrente
const CORRECOES_PACTO = { "corrente de cárceri": "corrente" };

const md = readFileSync(ENTRADA, "utf8").replace(/\r/g, "");
const ini = md.indexOf("\n### Invocações Místicas");
const fim = md.indexOf("\n## ", ini + 5);
if (ini < 0 || fim < 0) throw new Error("Seção das Invocações Místicas não encontrada");
const secao = md.slice(ini, fim);

const invocacoes = [];
for (const bloco of secao.split(/\n##### /).slice(1)) {
  const [titulo, ...resto] = bloco.split("\n");
  const nome = titulo.trim();
  let texto = resto.join("\n").trim();
  const requisitos = {};
  let requisitoTexto;
  const m = /^_Pré-requisito:\s*([^_]+?)_\s*/i.exec(texto);
  if (m) {
    requisitoTexto = m[1].trim();
    texto = texto.slice(m[0].length).trim();
    for (const parte of requisitoTexto.split(/,\s*/)) {
      const p = parte.toLowerCase().trim();
      const nivel = /^(\d+)°\s*nível$/.exec(p);
      const caract = /^característica\s+(.+)$/.exec(p);
      const truque = /^truque\s+(.+)$/.exec(p);
      if (nivel) requisitos.nivel = Number(nivel[1]);
      else if (caract) {
        const alvo = caract[1].trim();
        const pacto = Object.entries(PACTOS).find(([k]) => k === alvo)?.[1] ?? CORRECOES_PACTO[alvo];
        if (!pacto) throw new Error(`Característica desconhecida em "${nome}": ${alvo}`);
        requisitos.pacto = pacto;
      } else if (truque) requisitos.truque = slug(truque[1]);
      else throw new Error(`Pré-requisito não reconhecido em "${nome}": ${parte}`);
    }
  }
  invocacoes.push({ id: slug(nome), nome, pacote: "phb", ...(requisitoTexto ? { requisitoTexto, requisitos } : {}), texto });
}

writeFileSync(SAIDA, JSON.stringify(invocacoes, null, 2) + "\n", "utf8");
console.log(`${invocacoes.length} invocações gravadas em ${SAIDA}`);
