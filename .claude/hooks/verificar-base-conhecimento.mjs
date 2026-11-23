#!/usr/bin/env node
// Hook "Stop": garante que a base de conhecimento acompanhe o código.
// Se algum arquivo de código mudou DEPOIS da última edição em docs/base-conhecimento/, bloqueia o fim
// do turno uma vez e pede para o agente atualizar a base (ou registrar "sem impacto na base" no CHANGELOG).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const BASE = "docs/base-conhecimento";
// Mudanças nestes caminhos podem alterar features, fluxos, regras de acesso, dados ou rotas.
const MONITORADOS = [/^src\//, /^firestore\.rules$/, /^storage\.rules$/, /^next\.config\.ts$/, /^package\.json$/, /^openspec\/specs\//];
const IGNORADOS = [/\.test\.ts$/, /^src\/app\/favicon\.ico$/, /\.css$/];

let entrada = {};
try {
  entrada = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  /* sem stdin válido: segue */
}
// Já bloqueamos uma vez neste turno: não entra em laço.
if (entrada.stop_hook_active) process.exit(0);

function mtimeMaisRecente(dir) {
  let max = 0;
  let achou = false;
  const andar = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) andar(p);
      else {
        achou = true;
        max = Math.max(max, statSync(p).mtimeMs);
      }
    }
  };
  try {
    andar(dir);
  } catch {
    return { achou: false, max: 0 };
  }
  return { achou, max };
}

let status = "";
try {
  status = execFileSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: raiz, encoding: "utf8" });
} catch {
  process.exit(0); // sem git: não atrapalha
}

const arquivos = status
  .split("\0")
  .filter(Boolean)
  .map((l) => l.slice(3).replace(/\\/g, "/"))
  .filter((f) => MONITORADOS.some((r) => r.test(f)) && !IGNORADOS.some((r) => r.test(f)));

const base = mtimeMaisRecente(join(raiz, BASE));
const alterados = [];
for (const f of arquivos) {
  try {
    if (statSync(join(raiz, f)).mtimeMs > base.max) alterados.push(f);
  } catch {
    /* arquivo removido: sem data de modificação para comparar, então não entra (evita bloqueio eterno) */
  }
}

if (!alterados.length) process.exit(0);

const lista = alterados.slice(0, 15).map((f) => `- ${f}`).join("\n");
const mais = alterados.length > 15 ? `\n- … e mais ${alterados.length - 15}` : "";
const motivo = `Base de conhecimento desatualizada: há alterações de código mais novas que ${BASE}/.

Arquivos alterados:
${lista}${mais}

Antes de encerrar, siga .claude/rules/base-conhecimento.md (ou use a skill atualizar-base-conhecimento):
1. Atualize as páginas afetadas em ${BASE}/features/, fluxos/, permissoes-e-seguranca.md, arquitetura.md ou glossario.md (o quê, por quê, regras).
2. Acrescente uma linha em ${BASE}/CHANGELOG.md. Se a mudança não afeta nenhuma feature, fluxo, regra de acesso, modelo de dados ou rota, registre "sem impacto na base".
Não detalhe aparência de tela; documente comportamento, regras, dados e decisões.`;

process.stdout.write(JSON.stringify({ decision: "block", reason: motivo }));
