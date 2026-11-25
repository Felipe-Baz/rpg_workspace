import type { SistemaRegras } from "../sistema.ts";

/** Módulo de regras de D&D 5e. Opções ligadas pelo mestre nas configurações da mesa. */
export const dnd5e: SistemaRegras = {
  id: "dnd5e",
  nome: "D&D 5e",
  reconhece: (nome) => /d\s*&\s*d|dnd/i.test(nome), // mesma regra de `ehDnd5e` em src/lib/dnd5e.ts
  opcoes: [
    { id: "talentos", nome: "Talentos", descricao: "Permite escolher talentos no lugar de aumentos de atributo.", padrao: false },
    { id: "multiclasse", nome: "Multiclasse", descricao: "Permite combinar níveis de mais de uma classe.", padrao: false },
    { id: "compras", nome: "Compras no catálogo", descricao: "Permite aos jogadores comprarem itens do catálogo pela própria ficha (o mestre sempre pode).", padrao: false },
  ],
};
