// Lista de Magia Expandida do bruxo (patronos do Livro do Jogador): magias de fora da lista de bruxo que o patrono
// acrescenta. Conjunto fixo por patrono, em ids do catálogo; o círculo é o da própria magia (o limite de espaços
// continua valendo em `podeAprender`). Conferido contra o texto da subclasse em `listaExpandida.test.ts`.

import { classesDaFicha, type FichaDnd } from "../../dnd5e.ts";

export const LISTA_EXPANDIDA: Record<string, string[]> = {
  "a-arquifada": ["fogo-das-fadas", "sono", "acalmar-emocoes", "forca-fantasmagorica", "piscar", "ampliar-plantas", "dominar-besta", "invisibilidade-maior", "dominar-pessoa", "similaridade"],
  "o-corruptor": ["maos-flamejantes", "comando", "cegueira-surdez", "raio-ardente", "bola-de-fogo", "nevoa-fetida", "escudo-de-fogo", "muralha-de-fogo", "coluna-de-chamas", "consagrar"],
  "o-grande-antigo": ["sussurros-dissonantes", "riso-histerico-de-tasha", "detectar-pensamentos", "forca-fantasmagorica", "clarividencia", "enviar-mensagem", "dominar-besta", "tentaculos-negros-de-evard", "dominar-pessoa", "telecinesia"],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Id do patrono do bruxo da ficha (do `build` ou, sem ele, reconhecido no texto livre da subclasse). */
export function patronoDoBruxo(f: Pick<FichaDnd, "subclasse" | "build">): string | undefined {
  const doBuild = f.build?.classes?.find((c) => c.id === "bruxo")?.subclasse;
  if (doBuild && LISTA_EXPANDIDA[doBuild]) return doBuild;
  const t = norm(f.subclasse ?? "");
  return Object.keys(LISTA_EXPANDIDA).find((id) => t.includes(id.replace(/^(a|o)-/, "").replace(/-/g, " ")));
}

/** Ids das magias fora da lista de bruxo que o patrono da ficha libera (vazio se não for bruxo com patrono). */
export function magiasExpandidas(f: Pick<FichaDnd, "subclasse" | "build" | "classe" | "nivel" | "classes">): string[] {
  const p = classesDaFicha(f).some((c) => c.id === "bruxo") ? patronoDoBruxo(f) : undefined;
  return p ? LISTA_EXPANDIDA[p] : [];
}
