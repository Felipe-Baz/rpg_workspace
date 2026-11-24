import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATALHOS_JOGADOR, buscarNoLivro, extrairSumario, indexarSecoes, slug, textoPuro, type SecaoLivro } from "./livros.ts";

test("slug tira acentos e pontuação", () => {
  assert.equal(slug("Classes de Dificuldade (CD) típicas"), "classes-de-dificuldade-cd-tipicas");
  assert.equal(slug("Chegando a 0 PV"), "chegando-a-0-pv");
});

test("sumário lista cabeçalhos internos sem repetir", () => {
  const md = "texto\n\n### Fúria\n\nx\n\n#### Fúria\n\n#### Defesa sem Armadura";
  assert.deepEqual(extrairSumario(md).map((i) => i.id), ["furia", "defesa-sem-armadura"]);
});

test("textoPuro remove marcação e tabelas", () => {
  assert.equal(textoPuro("**Fúria** em [link](http://x)\n\n| a | b |\n|---|---|\n| 1 | 2 |"), "Fúria em link a b 1 2");
});

test("busca exige todos os termos e prioriza o título", () => {
  const indice = indexarSecoes("regras", [
    { id: "cobertura", titulo: "Cobertura", md: "Meia-cobertura dá +2 na CA." },
    { id: "combate", titulo: "Combate", md: "Veja cobertura e iniciativa." },
  ]);
  const r = buscarNoLivro(indice, "cobertura");
  assert.equal(r[0].entrada.secao, "cobertura");
  assert.equal(r.length, 2);
  assert.equal(buscarNoLivro(indice, "cobertura dragão").length, 0);
  assert.equal(buscarNoLivro(indice, "COBERTURA")[0].entrada.secao, "cobertura");
});

test("todo atalho da consulta rápida aponta para uma seção que existe nos dados gerados", () => {
  for (const a of ATALHOS_JOGADOR) {
    const dados = JSON.parse(readFileSync(new URL(`../data/livros/jogador/${a.capitulo}.json`, import.meta.url), "utf8")) as { secoes: SecaoLivro[] };
    assert.ok(dados.secoes.some((s) => s.id === a.secao), `${a.rotulo}: ${a.capitulo}/${a.secao}`);
  }
});

test("ids de seção são únicos em cada capítulo", () => {
  for (const c of ["regras", "conjuracao", "classes", "racas", "antecedentes", "talentos", "equipamento"]) {
    const dados = JSON.parse(readFileSync(new URL(`../data/livros/jogador/${c}.json`, import.meta.url), "utf8")) as { secoes: SecaoLivro[] };
    const ids = dados.secoes.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, c);
    assert.ok(dados.secoes.every((s) => s.md.length > 0), c);
  }
});
