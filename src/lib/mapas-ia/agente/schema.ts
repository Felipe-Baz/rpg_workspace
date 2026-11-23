// Validação dos argumentos das ferramentas contra o mesmo schema enviado ao LLM.
import type { Schema } from "./tipos.ts";

/** Lista de erros legíveis (vazia = válido). Campos fora do schema são ignorados. */
export function validarSchema(s: Schema, v: unknown, caminho = "args"): string[] {
  const erros: string[] = [];
  switch (s.type) {
    case "object": {
      if (!v || typeof v !== "object" || Array.isArray(v)) return [`${caminho} deve ser um objeto.`];
      const o = v as Record<string, unknown>;
      for (const r of s.required ?? []) if (o[r] === undefined || o[r] === null) erros.push(`${caminho}.${r} é obrigatório.`);
      for (const [k, sub] of Object.entries(s.properties ?? {})) {
        if (o[k] !== undefined && o[k] !== null) erros.push(...validarSchema(sub, o[k], `${caminho}.${k}`));
      }
      break;
    }
    case "array": {
      if (!Array.isArray(v)) return [`${caminho} deve ser uma lista.`];
      if (s.minItems !== undefined && v.length < s.minItems) erros.push(`${caminho} precisa de ao menos ${s.minItems} item(ns).`);
      if (s.maxItems !== undefined && v.length > s.maxItems) erros.push(`${caminho} aceita no máximo ${s.maxItems} item(ns).`);
      if (s.items) v.forEach((x, i) => erros.push(...validarSchema(s.items!, x, `${caminho}[${i}]`)));
      break;
    }
    case "string":
      if (typeof v !== "string") return [`${caminho} deve ser texto.`];
      if (s.maxLength !== undefined && v.length > s.maxLength) erros.push(`${caminho} aceita no máximo ${s.maxLength} caracteres.`);
      break;
    case "number":
    case "integer":
      if (typeof v !== "number" || !Number.isFinite(v)) return [`${caminho} deve ser um número.`];
      if (s.type === "integer" && !Number.isInteger(v)) erros.push(`${caminho} deve ser inteiro.`);
      if (s.minimum !== undefined && v < s.minimum) erros.push(`${caminho} deve ser ≥ ${s.minimum}.`);
      if (s.maximum !== undefined && v > s.maximum) erros.push(`${caminho} deve ser ≤ ${s.maximum}.`);
      break;
    case "boolean":
      if (typeof v !== "boolean") return [`${caminho} deve ser verdadeiro ou falso.`];
      break;
  }
  if (s.enum && !s.enum.includes(v as string | number)) erros.push(`${caminho} deve ser um de: ${s.enum.join(", ")}.`);
  return erros;
}
