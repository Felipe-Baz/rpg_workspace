// Magias que o livro concede de graça por raça, sub-raça, domínio, juramento e círculo: entram na ficha como "sempre
// preparadas" (fora dos limites da classe). Tabela CURADA (ids do catálogo de magias). Quem grava na ficha é o assistente
// de criação e o de subida de nível (`aplicarMagiasConcedidas`); o jogador só vê magias a mais, nunca perde as suas.

import type { Atributo, FichaDnd, Magia } from "../../dnd5e.ts";
import { nivelTotal, type Build } from "./build.ts";
import type { FonteAtiva } from "./derivar.ts";
import { magiaParaFicha, type MagiaCat } from "./magias.ts";

export type MagiaConcedida = {
  catalogoId: string;
  /** Atributo de conjuração próprio (magia racial). */
  atributo?: Atributo;
  /** Classe pela qual conjura (magia de domínio/juramento/círculo). */
  classeOrigem?: string;
  origem: string;
};

type Linha = [nivel: number, ...ids: string[]];

// nível do PERSONAGEM (raça)
const RACIAIS: Record<string, { atr?: Atributo | "escolha"; linhas: Linha[] }> = {
  "tiefling-infernal": { atr: "car", linhas: [[1, "taumaturgia"], [3, "repreensao-infernal"], [5, "escuridao"]] },
  "tiefling-abyssal": { atr: "escolha", linhas: [[1, "rajada-de-veneno", "taumaturgia"], [3, "raio-adoecente"], [5, "imobilizar-pessoa"]] },
  "tiefling-chthonic": { atr: "escolha", linhas: [[1, "toque-arrepiante", "taumaturgia"], [3, "vitalidade-falsa"], [5, "raio-do-enfraquecimento"]] },
  "elfo-negro-drow": { atr: "car", linhas: [[1, "globos-de-luz"], [3, "fogo-das-fadas"], [5, "escuridao"]] },
};

// nível NA CLASSE (domínio, juramento, círculo)
const DOMINIOS: Record<string, { classe: string; linhas: Linha[] }> = {
  "dominio-do-conhecimento": { classe: "clerigo", linhas: [[1, "comando", "identificacao"], [3, "augurio", "sugestao"], [5, "dissipar-magia", "falar-com-os-mortos"], [7, "confusao", "olho-arcano"], [9, "conhecimento-lendario", "videncia"]] },
  "dominio-da-enganacao": { classe: "clerigo", linhas: [[1, "enfeiticar-pessoa", "disfarcar-se"], [3, "reflexos", "passos-sem-pegadas"], [5, "piscar", "dissipar-magia"], [7, "porta-dimensional", "metamorfose"], [9, "dominar-pessoa", "modificar-memoria"]] },
  "dominio-da-guerra": { classe: "clerigo", linhas: [[1, "auxilio-divino", "escudo-da-fe"], [3, "arma-magica", "arma-espiritual"], [5, "manto-do-cruzado", "espiritos-guardioes"], [7, "movimentacao-livre", "pele-de-pedra"], [9, "coluna-de-chamas", "imobilizar-monstro"]] },
  "dominio-da-luz": { classe: "clerigo", linhas: [[1, "luz", "maos-flamejantes", "fogo-das-fadas"], [3, "esfera-flamejante", "raio-ardente"], [5, "bola-de-fogo", "luz-do-dia"], [7, "guardiao-da-fe", "muralha-de-fogo"], [9, "coluna-de-chamas", "videncia"]] },
  "dominio-da-natureza": { classe: "clerigo", linhas: [[1, "amizade-animal", "falar-com-animais"], [3, "pele-de-arvore", "crescer-espinhos"], [5, "ampliar-plantas", "muralha-de-vento"], [7, "dominar-besta", "vinha-esmagadora"], [9, "praga-de-insetos", "caminhar-em-arvores"]] },
  "dominio-da-tempestade": { classe: "clerigo", linhas: [[1, "nevoa-obscurecente", "onda-trovejante"], [3, "lufada-de-vento", "despedacar"], [5, "convocar-relampagos", "nevasca"], [7, "controlar-a-agua", "tempestade-de-gelo"], [9, "onda-destrutiva", "praga-de-insetos"]] },
  "dominio-da-vida": { classe: "clerigo", linhas: [[1, "bencao", "curar-ferimentos"], [3, "restauracao-menor", "arma-espiritual"], [5, "sinal-de-esperanca", "revivificar"], [7, "protecao-contra-a-morte", "guardiao-da-fe"], [9, "curar-ferimentos-em-massa", "reviver-os-mortos"]] },
  "dominio-da-morte": { classe: "clerigo", linhas: [[1, "vitalidade-falsa", "raio-adoecente"], [3, "cegueira-surdez", "raio-do-enfraquecimento"], [5, "animar-mortos", "toque-vampirico"], [7, "malogro", "protecao-contra-a-morte"], [9, "cupula-antivida", "nevoa-mortal"]] },
  "juramento-de-devocao": { classe: "paladino", linhas: [[3, "protecao-contra-o-bem-e-mal", "santuario"], [5, "restauracao-menor", "zona-da-verdade"], [9, "sinal-de-esperanca", "dissipar-magia"], [13, "movimentacao-livre", "guardiao-da-fe"], [17, "comunhao", "coluna-de-chamas"]] },
  "juramento-dos-ancioes": { classe: "paladino", linhas: [[3, "golpe-constritor", "falar-com-animais"], [5, "raio-lunar", "passo-nebuloso"], [9, "ampliar-plantas", "protecao-contra-energia"], [13, "tempestade-de-gelo", "pele-de-pedra"], [17, "comunhao-com-a-natureza", "caminhar-em-arvores"]] },
  "juramento-de-vinganca": { classe: "paladino", linhas: [[3, "perdicao", "marca-do-cacador"], [5, "imobilizar-pessoa", "passo-nebuloso"], [9, "velocidade", "protecao-contra-energia"], [13, "banimento", "porta-dimensional"], [17, "imobilizar-monstro", "videncia"]] },
  "quebrador-de-juramento": { classe: "paladino", linhas: [[3, "repreensao-infernal", "infligir-ferimentos"], [5, "coroa-da-loucura", "escuridao"], [9, "animar-mortos", "rogar-maldicao"], [13, "malogro", "confusao"], [17, "doenca-plena", "dominar-pessoa"]] },
};

// Círculo da Terra: por terreno, níveis de druida 3, 5, 7 e 9
const TERRENOS: Record<string, string[][]> = {
  "ártico": [["imobilizar-pessoa", "crescer-espinhos"], ["nevasca", "lentidao"], ["movimentacao-livre", "tempestade-de-gelo"], ["comunhao-com-a-natureza", "cone-de-frio"]],
  costa: [["reflexos", "passo-nebuloso"], ["respirar-na-agua", "andar-na-agua"], ["controlar-a-agua", "movimentacao-livre"], ["conjurar-elemental", "videncia"]],
  deserto: [["nublar", "silencio"], ["criar-alimentos", "protecao-contra-energia"], ["malogro", "terreno-alucinogeno"], ["praga-de-insetos", "muralha-de-pedra"]],
  floresta: [["pele-de-arvore", "patas-de-aranha"], ["convocar-relampagos", "ampliar-plantas"], ["adivinhacao", "movimentacao-livre"], ["comunhao-com-a-natureza", "caminhar-em-arvores"]],
  pradaria: [["invisibilidade", "passos-sem-pegadas"], ["luz-do-dia", "velocidade"], ["adivinhacao", "movimentacao-livre"], ["sonho", "praga-de-insetos"]],
  montanha: [["patas-de-aranha", "crescer-espinhos"], ["relampago", "mesclar-se-as-rochas"], ["moldar-rochas", "pele-de-pedra"], ["criar-passagem", "muralha-de-pedra"]],
  "pântano": [["escuridao", "flecha-acida-de-melf"], ["andar-na-agua", "nevoa-fetida"], ["movimentacao-livre", "localizar-criatura"], ["praga-de-insetos", "videncia"]],
};
const NIVEIS_TERRA = [3, 5, 7, 9];

const SABEDORIA_DAS_FONTES: Record<string, Atributo> = { "alto-elfo": "int", "dominio-da-natureza": "sab", "circulo-da-terra": "sab" };

/** Magias concedidas pelo build neste nível (as dos níveis já alcançados). `fontes` traz os truques escolhidos (alto elfo, domínio...). */
export function magiasConcedidas(b: Build, fontes: Pick<FonteAtiva, "id" | "nome" | "truques">[]): MagiaConcedida[] {
  const out: MagiaConcedida[] = [];
  const nivel = nivelTotal(b);
  const racial = b.raca?.sub ? RACIAIS[b.raca.sub] : undefined;
  if (racial) {
    const escolhido = b.raca?.escolhas?.["atributo-conjuracao"]?.[0] as Atributo | undefined;
    const atributo: Atributo = racial.atr === "escolha" ? (escolhido ?? "car") : (racial.atr ?? "car");
    for (const [n, ...ids] of racial.linhas) if (n <= nivel) for (const id of ids) out.push({ catalogoId: id, atributo, origem: b.raca!.sub! });
  } else if (b.raca?.id === "tiefling") {
    // fichas que ainda não escolheram legado: valem os da raça base (Legado Infernal)
    for (const [n, ...ids] of RACIAIS["tiefling-infernal"].linhas) if (n <= nivel) for (const id of ids) out.push({ catalogoId: id, atributo: "car", origem: "tiefling" });
  }
  for (const c of b.classes) {
    const dom = c.subclasse ? DOMINIOS[c.subclasse] : undefined;
    if (dom && dom.classe === c.id) for (const [n, ...ids] of dom.linhas) if (n <= c.nivel) for (const id of ids) out.push({ catalogoId: id, classeOrigem: c.id, origem: c.subclasse! });
    // Trapaceiro Arcano: aprende o truque Mão Mágica além dos truques da lista (e a Mão do Trapaceiro Arcano faz dela uma ferramenta de ladrão)
    if (c.id === "ladino" && c.subclasse === "trapaceiro-arcano" && c.nivel >= 3) out.push({ catalogoId: "maos-magicas", atributo: "int", origem: "trapaceiro-arcano" });
    if (c.id === "druida" && c.subclasse === "circulo-da-terra") {
      const t = TERRENOS[c.escolhas?.["terreno-circulo"]?.[0] ?? ""];
      if (t) NIVEIS_TERRA.forEach((n, i) => { if (n <= c.nivel) for (const id of t[i]) out.push({ catalogoId: id, classeOrigem: "druida", origem: "circulo-da-terra" }); });
    }
  }
  // truques escolhidos como concessão (alto elfo, Domínio da Natureza, Círculo da Terra)
  for (const f of fontes) for (const id of f.truques) out.push({ catalogoId: id, atributo: SABEDORIA_DAS_FONTES[f.id] ?? "sab", origem: f.id });
  const vistos = new Set<string>();
  return out.filter((m) => (vistos.has(m.catalogoId) ? false : vistos.add(m.catalogoId)));
}

/** Acrescenta à ficha as magias concedidas que ela ainda não tem (por `catalogoId`), como sempre preparadas. */
export function aplicarMagiasConcedidas(f: FichaDnd, concedidas: MagiaConcedida[], catalogo: MagiaCat[], novoId: () => string): FichaDnd {
  const tem = new Set(f.magias.map((m) => m.catalogoId).filter(Boolean));
  const novas: Magia[] = [];
  for (const c of concedidas) {
    if (tem.has(c.catalogoId)) continue;
    const m = catalogo.find((x) => x.id === c.catalogoId);
    if (!m) continue;
    novas.push({ ...magiaParaFicha(m, novoId(), true), sempre: true, ...(c.atributo ? { atributoConj: c.atributo } : {}), ...(c.classeOrigem ? { classeOrigem: c.classeOrigem } : {}) });
  }
  return novas.length ? { ...f, magias: [...f.magias, ...novas] } : f;
}
