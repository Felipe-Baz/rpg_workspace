// Dados NÃO-spoiler das Marcas: seguros para ir no código (visíveis a qualquer jogador por design).
// A mecânica real (Passiva, Fardo, Habilidade, Nove Círculos, Remoção) vive só em `lore/{markId}`.

export type Marca = { id: string; name: string; sold: string; build: string };

export const MARCAS: Marca[] = [
  { id: "eco-vazio", name: "Marca do Eco Vazio", sold: "a dor e o medo — os primeiros avisos de que um corpo está em perigo.", build: "Marcial de linha de frente / tanque" },
  { id: "maos-que-lembram", name: "Marca das Mãos que Lembram", sold: "a memória contínua de rostos, nomes e do próprio passado.", build: "Perícia e versatilidade social" },
  { id: "sangue-que-nega", name: "Marca do Sangue que Nega", sold: "a conexão com a vida — cicatrização natural e aceitação instintiva de criaturas vivas.", build: "Combate sustentado sem suporte de cura" },
  { id: "voz-perdida", name: "Marca da Voz Perdida", sold: "o próprio nome verdadeiro e a liberdade de mentir.", build: "Face / social" },
  { id: "reflexo-partido", name: "Marca do Reflexo Partido", sold: "a própria imagem — o reconhecimento contínuo de que existe para o mundo.", build: "Furtivo / infiltração" },
  { id: "juramento-cinzento", name: "Marca do Juramento Cinzento", sold: "a possibilidade de ser perdoado por uma convicção pessoal quebrada.", build: "Convicção / zelote" },
  { id: "segundo-pacto", name: "Marca do Segundo Pacto", sold: "a autonomia da própria vontade dentro de qualquer poder emprestado.", build: "Caster de fonte externa" },
  { id: "pagina-que-esquece", name: "Marca da Página que Esquece", sold: "a confiabilidade da própria mente como ferramenta de aprendizado e registro.", build: "Conhecimento e utilidade" },
  { id: "sono-roubado", name: "Marca do Sono Roubado", sold: "o sono tranquilo e os sonhos como refúgio.", build: "Suporte / vidência" },
  { id: "fome-eterna", name: "Marca da Fome Eterna", sold: "a saciedade — a sensação de 'já basta'.", build: "Força bruta / burst de dano" },
  { id: "coracao-de-ferro", name: "Marca do Coração de Ferro", sold: "a capacidade de se apegar emocionalmente a alguém novo.", build: "Resistência mental / estoico" },
  { id: "maos-manchadas", name: "Marca das Mãos Manchadas", sold: "a inocência — não carregar visivelmente o peso do que fez.", build: "Dano concentrado / assassino" },
  { id: "tempo-perdido", name: "Marca do Tempo Perdido", sold: "a percepção linear e confiável do tempo.", build: "Controle / tática" },
  { id: "fera-interior", name: "Marca da Fera Interior", sold: "o controle total sobre os próprios instintos mais básicos.", build: "Primal / natureza" },
  { id: "silencio-divino", name: "Marca do Silêncio Divino", sold: "a capacidade de ser ouvido por qualquer força divina.", build: "Divino / anti-divino" },
  { id: "sombra-viva", name: "Marca da Sombra Viva", sold: "o controle total sobre a própria sombra, que ganhou vontade parcial.", build: "Reconhecimento / batedor" },
  { id: "preco-justo", name: "Marca do Preço Justo", sold: "o senso de 'o suficiente' — a capacidade de recusar uma barganha vantajosa.", build: "Negociação / suporte de grupo" },
  { id: "pele-de-vidro", name: "Marca da Pele de Vidro", sold: "a confiabilidade da própria resistência física.", build: "Dano concentrado / demolição" },
  { id: "ultimo-suspiro", name: "Marca do Último Suspiro", sold: "a certeza de uma morte natural.", build: "Morte / necromancia" },
  { id: "coro-silencioso", name: "Marca do Coro Silencioso", sold: "a solidão da própria alma.", build: "Suporte de grupo" },
];

export const marcaPorId = (id: string | undefined | null) => MARCAS.find((m) => m.id === id);
export const indiceDaMarca = (id: string) => MARCAS.findIndex((m) => m.id === id);

// Formato do gabarito (coleção lore/{markId}) — só o Mestre lê/escreve.
export type Lore = {
  sold?: string;
  passivaNome: string;
  passiva: string;
  fardo: string;
  habilidadeNome: string;
  habilidade: string;
  circles: { circulo: string; gatilho: string; mudanca: string }[];
  remocao: string;
};

// Nível da evolução, cadastrado pelo próprio jogador conforme o que ele acredita.
export type Nivel = { id: string; nome: string; gatilho: string; mudanca: string };

export type Notas = {
  passiva: string;
  fardo: string;
  habilidade: string;
  postits: { id: string; text: string }[];
  niveis: Nivel[];
};

export const NOTAS_VAZIAS: Notas = { passiva: "", fardo: "", habilidade: "", postits: [], niveis: [] };

// ----- Enigmas -----
// Cada etapa pode ter uma "mecânica": um puzzle jogável (cifra, lanterna, morse, cadeado…).
// `solucao` aceita alternativas separadas por "|" e vive só no banco do Mestre; ao liberar,
// vira `hashes` (ver puzzle-util.ts). Evite arrays aninhados: o Firestore não os aceita.
type Base = { solucao?: string; dica?: string };
export type Mecanica = Base &
  (
    | { tipo: "cifra"; modo: "cesar" | "atbash" | "espelho" | "runico"; cifrado: string; deslocamento?: number }
    | { tipo: "lanterna"; palavras: { t: string; x: number; y: number }[] }
    | { tipo: "rastros"; texto: string; revelacoes: string[] }
    | { tipo: "morse"; codigo: string }
    | { tipo: "fragmentos"; pecas: string[] }
    | { tipo: "relogio" }
    | { tipo: "runas"; aneis: string[] }
    | { tipo: "escolha"; rodadas: { fala: string; opcoes: string[] }[] }
    | { tipo: "espera"; modo: "segurar" | "quietude"; segundos: number; rotulo?: string; tentacoes?: string[] }
  );
type SemSolucao<T> = T extends unknown ? Omit<T, "solucao"> : never;
export type MecanicaLiberada = SemSolucao<Mecanica> & { sal?: string; hashes?: string[] };

export type PuzzleEtapa = { titulo: string; texto: string; pergunta: string; resposta: string; revelacao?: string; mecanica?: Mecanica };
export type Puzzle = { titulo: string; ambiente?: string; etapas: PuzzleEtapa[] };
// Etapa liberada ao jogador: SEM o gabarito.
export type EtapaLiberada = {
  idx: number;
  titulo: string;
  texto: string;
  pergunta: string;
  ambiente?: string;
  revelacao?: string;
  mecanica?: MecanicaLiberada;
};
export type Veredito = { estado: "aprovada" | "recusada"; nota?: string };
