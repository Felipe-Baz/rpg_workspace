// Variações de antecedente do Livro do Jogador (texto dos quadros "Variação de ..."). Tabela CURADA: cada variação é uma
// escolha opcional do jogador (`build.antecedente.variacao`) que pode trocar a característica do antecedente ou uma escolha.

import type { EscolhaDef } from "./catalogo.ts";

export type VariacaoAntecedente = {
  id: string;
  nome: string;
  descricao: string;
  /** Substitui a característica do antecedente. */
  caracteristica?: { nome: string; texto: string };
  /** Ids de escolhas do antecedente que esta variação troca, e as escolhas que entram no lugar. */
  substitui?: string[];
  escolhas?: EscolhaDef[];
};

export const VARIACOES_ANTECEDENTE: Record<string, VariacaoAntecedente[]> = {
  "artesao-de-guilda": [{
    id: "mercador-de-guilda", nome: "Mercador de Guilda",
    descricao: "Você pertence a uma guilda de mercadores, mestres de caravana ou comerciantes: não constrói itens, compra e vende o trabalho dos outros. Ao invés de proficiência com ferramentas de artesão, você tem proficiência com ferramentas de navegador ou um idioma adicional (anote o idioma em \"Outras proficiências e idiomas\"). Ao invés de ferramentas de artesão, você pode começar com uma mula ou carroça.",
    substitui: ["ferramenta-1"],
    escolhas: [{ id: "mercador", rotulo: "No lugar das ferramentas de artesão", tipo: "opcao", qtd: 1, opcoes: [
      { id: "navegador", nome: "Ferramentas de navegador", descricao: "Proficiência com ferramentas de navegação.", concede: { ferramentas: ["Ferramentas de navegação"] } },
      { id: "idioma", nome: "Um idioma adicional", descricao: "Escreva o idioma escolhido em \"Outras proficiências e idiomas\"." },
    ] }],
  }],
  artista: [{
    id: "gladiador", nome: "Gladiador",
    descricao: "Um gladiador é um artista treinado para tornar o combate um espetáculo. Usando Pela Demanda Popular, você encontra um lugar para atuar onde o combate for entretenimento (uma arena, um clube de luta secreto). Você pode trocar o instrumento musical do seu equipamento por uma arma barata, porém incomum, como um tridente ou uma rede.",
  }],
  criminoso: [{
    id: "espiao", nome: "Espião",
    descricao: "Suas habilidades não são muito diferentes das de ladrões ou contrabandistas, mas você as aprendeu e as praticou como agente de espionagem: um oficial sancionado pela coroa ou alguém que vende os segredos que descobre pela maior oferta.",
  }],
  marinheiro: [{
    id: "pirata", nome: "Pirata",
    descricao: "Você passou a juventude sob o domínio de um pirata infame, participou de saques em alto-mar e tem má fama em várias cidades portuárias. Você pode escolher a característica Má Reputação ao invés de Passagens de Navio.",
    caracteristica: { nome: "Má Reputação", texto: "Não importa aonde você vá, as pessoas têm medo de você devido a sua reputação. Quando você está em locais civilizados, você pode cometer pequenos delitos, como se negar a pagar por comida em uma taverna ou pôr abaixo portas de lojas locais, já que a maioria das pessoas não vai denunciar suas atividades às autoridades." },
  }],
  nobre: [{
    id: "cavaleiro", nome: "Cavaleiro",
    descricao: "A fidalguia está entre os títulos de nobreza mais baixos, mas pode ser o caminho para posições maiores. Escolha a característica Retentores ao invés de Posição Privilegiada: um dos retentores é um nobre que serve como seu escudeiro. Inclua entre seus equipamentos um estandarte ou outro símbolo de um lorde ou lady a quem você deu seu coração (essa pessoa pode ser seu vínculo).",
    caracteristica: { nome: "Retentores", texto: "Você tem o serviço de três retentores leais à sua família. Esses retentores podem ser atendentes ou mensageiros, e um pode ser um mordomo. Seus retentores são camponeses que podem realizar tarefas comuns para você, mas eles não irão lutar por você, não irão segui-lo para áreas obviamente perigosas (como masmorras) e irão embora se forem frequentemente expostos ao perigo ou abuso." },
  }],
};

export const variacoesDoAntecedente = (antecedenteId: string) => VARIACOES_ANTECEDENTE[antecedenteId] ?? [];
export const variacaoEscolhida = (antecedenteId: string, variacaoId?: string) => variacoesDoAntecedente(antecedenteId).find((v) => v.id === variacaoId);
