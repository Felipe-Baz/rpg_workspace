// Modelo de dados da cena (módulo puro: sem React, Firebase ou Pixi, para ser testável em Node).

export type TipoCamada = "terreno" | "caminhos" | "decals" | "objetos" | "rotulos";

export type Camada = {
  id: string;
  nome: string;
  tipo: TipoCamada;
  visivel: boolean;
  travada: boolean;
  opacidade: number; // 0–1
};

export type TipoAsset = "sprite" | "textura" | "pincel" | "decal";

/** Como o asset foi gerado (só `origem: "ia"`). */
export type GeradoPor = { provedor: string; modelo: string; prompt: string };

/** Documento mesas/{id}/assets/{assetId}. Os campos da biblioteca são opcionais: assets enviados antes da change 06 não os têm. */
export type Asset = {
  id: string;
  nome: string;
  url: string;
  largura: number; // px naturais
  altura: number;
  origem: "enviado" | "ia";
  /** Ausente = sprite. */
  tipo?: TipoAsset;
  tags?: string[];
  /** Ausente = top-down (assets anteriores à change 05). */
  perspectivaId?: string;
  temaId?: string;
  /** Largura sugerida ao carimbar, em células do grid (ausente = 1). */
  escalaBase?: number;
  geradoPor?: GeradoPor;
  /** Asset de que esta é uma nova versão (regeneração). */
  versaoDeId?: string;
  /** Há uma cópia na biblioteca pública (mesmo id); o arquivo no Storage é compartilhado e a mesa não o apaga. */
  publico?: boolean;
  /** Textura que não passou na verificação de bordas. */
  naoRepetivel?: boolean;
  criadoEm: number;
};

/**
 * Posição em fração (0–1) do canvas. `escala` é a largura do objeto como fração da
 * largura do canvas (a altura segue a proporção do asset), então não depende da resolução.
 */
export type ObjetoCena = {
  id: string;
  assetId: string;
  camadaId: string;
  x: number;
  y: number;
  escala: number;
  rotacao: number; // radianos
  espelhado: boolean;
  z: number;
};

export type Grid = {
  tipo: "quadrado" | "hex";
  colunas: number;
  linhas: number;
  /** Se o grid entra na imagem final. */
  noRender: boolean;
};

export type Cena = {
  id: string;
  nome: string;
  mapaId?: string;
  modo: "grid" | "cenario";
  /** Id de uma perspectiva do registro (mapas-ia/perspectivas). Grid é sempre "topdown". */
  perspectiva: string;
  /** Tema da mesa (mesas/{id}/temas/{temaId}); opcional. */
  temaId?: string;
  largura: number; // px; só a resolução muda, nunca a proporção
  altura: number;
  grid?: Grid;
  fundo: string; // cor CSS
  camadas: Camada[];
  objetos: ObjetoCena[];
  criadoEm: number;
  atualizadoEm: number;
};

export const LADO_MAXIMO_RENDER = 4096;

export const TIPOS_CAMADA: { tipo: TipoCamada; nome: string }[] = [
  { tipo: "terreno", nome: "Terreno" },
  { tipo: "caminhos", nome: "Caminhos" },
  { tipo: "decals", nome: "Decals" },
  { tipo: "objetos", nome: "Objetos" },
  { tipo: "rotulos", nome: "Rótulos" },
];
