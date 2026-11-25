// Registro dos sistemas com regras automatizadas. Para adicionar um sistema: criar `regras/<id>/index.ts`
// exportando um `SistemaRegras` e incluí-lo em SISTEMAS.

import type { SistemaRegras } from "./sistema.ts";
import { dnd5e } from "./dnd5e/index.ts";

const SISTEMAS: readonly SistemaRegras[] = [dnd5e];

/** Módulo de regras do sistema da mesa, ou `undefined` se não houver ficha automatizada para ele. */
export const regrasDoSistema = (nomeSistema: string): SistemaRegras | undefined => SISTEMAS.find((s) => s.reconhece(nomeSistema));

export const sistemasComRegras = (): readonly SistemaRegras[] => SISTEMAS;
