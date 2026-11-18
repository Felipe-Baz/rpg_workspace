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
  /** Edição por instrução (ou máscara, conforme capacidades.inpainting). */
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

export type Provedor = ProvedorImagem | ProvedorLlm;

/** Erro de provedor com mensagem já saneada (sem segredos). */
export class ErroProvedor extends Error {}
