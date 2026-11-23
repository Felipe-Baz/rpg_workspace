// Contratos da camada de IA. Nenhum import de fornecedor aqui: o núcleo só conhece estas interfaces.

export type HttpFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Campo de configuração; a tela de IA é gerada a partir desta lista. */
export interface CampoConfig {
  chave: string;
  rotulo: string;
  tipo: "texto" | "segredo";
  /** Valor sugerido (ex.: modelo). */
  padrao?: string;
  ajuda?: string;
}

export interface CapacidadesImagem {
  alfaNativo: boolean;
  /** Máximo de imagens de referência aceitas (0 = não aceita). */
  imagensReferencia: number;
  /** "instrucao" = edição por texto, sem máscara. */
  inpainting: "nenhum" | "instrucao" | "mascara";
  seed: boolean;
  tamanhos: string[];
}

export interface CapacidadesLlm {
  visao: boolean;
  ferramentas: boolean;
}

export interface ImagemBase64 {
  mime: string;
  base64: string;
}

export interface ContextoProvedor {
  /** Valores dos campos: segredos (da credencial) e não-segredos (do provedor). */
  config: Record<string, string>;
  http: HttpFn;
}

interface ProvedorBase {
  id: string;
  nome: string;
  /** Fabricante: provedores com o mesmo credencialId compartilham a chave. */
  credencialId: string;
  campos: CampoConfig[];
  /** Chamada mínima; lança Error se a conexão/chave falhar. */
  testar(ctx: ContextoProvedor): Promise<void>;
}

export interface PedidoImagem {
  prompt: string;
  referencias?: ImagemBase64[];
  tamanho?: string;
  seed?: number;
}

export interface ProvedorImagem extends ProvedorBase {
  tipo: "imagem";
  capacidades: CapacidadesImagem;
  gerar(ctx: ContextoProvedor, pedido: PedidoImagem): Promise<ImagemBase64>;
  /** Edição por instrução (ou máscara, conforme capacidades.inpainting). Também é o inpainting da conversão em cena. */
  editar?(ctx: ContextoProvedor, pedido: PedidoImagem & { imagem: ImagemBase64 }): Promise<ImagemBase64>;
}

// ----- Ferramentas neutras (independentes de fabricante) -----
export interface FerramentaNeutra {
  nome: string;
  descricao: string;
  /** JSON Schema do objeto de argumentos. */
  parametros: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}
export interface ChamadaFerramenta {
  id: string;
  nome: string;
  argumentos: Record<string, unknown>;
  /** Dado opaco do provedor que precisa voltar junto com a chamada (ex.: thoughtSignature do Gemini 3). */
  assinatura?: string;
}
export interface MensagemLlm {
  papel: "usuario" | "assistente" | "ferramenta";
  texto?: string;
  imagens?: ImagemBase64[];
  /** papel "assistente": chamadas feitas. */
  chamadas?: ChamadaFerramenta[];
  /** papel "ferramenta": resultado de uma chamada. */
  resultadoDe?: { id: string; nome: string };
}
export interface PedidoLlm {
  sistema?: string;
  mensagens: MensagemLlm[];
  ferramentas?: FerramentaNeutra[];
}
export interface RespostaLlm {
  texto: string;
  chamadas: ChamadaFerramenta[];
}

export interface ProvedorLlm extends ProvedorBase {
  tipo: "llm";
  capacidades: CapacidadesLlm;
  conversar(ctx: ContextoProvedor, pedido: PedidoLlm): Promise<RespostaLlm>;
}

// ----- Segmentação (separar objetos de uma imagem) -----
export interface CapacidadesSegmentacao {
  /** "mascara" = contorno por pixel; "caixa" = só retângulos. */
  saida: "mascara" | "caixa";
  /** Máximo de objetos por chamada. */
  maxObjetos: number;
}

/** Retângulo em fração (0–1) da imagem. */
export interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SegmentoBruto {
  rotulo: string;
  caixa: Caixa;
  /** Máscara em tons de cinza com o tamanho da caixa (>= 128 = objeto). Ausente: a caixa inteira. */
  mascara?: ImagemBase64;
}

export interface PedidoSegmentacao {
  imagem: ImagemBase64;
  /** Contexto opcional (ex.: "mapa top-down de taverna"). */
  dica?: string;
  maxObjetos?: number;
}

/** Ponto de extensão: novo segmentador = um arquivo em ./provedores e uma linha no registro. */
export interface Segmentador extends ProvedorBase {
  tipo: "segmentacao";
  capacidades: CapacidadesSegmentacao;
  segmentar(ctx: ContextoProvedor, pedido: PedidoSegmentacao): Promise<SegmentoBruto[]>;
}

export type Provedor = ProvedorImagem | ProvedorLlm | Segmentador;
export type TipoProvedor = Provedor["tipo"];

/** Erro de provedor com mensagem já saneada (sem segredos). */
export class ErroProvedor extends Error {}
