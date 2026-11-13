// Atmosfera de cada Marca: cor, partículas, efeito de tela e zumbido. A chave é o id da Marca
// (o campo `ambiente` do puzzle). Nada aqui é spoiler.
export type Particula = {
  cor: string;
  forma: "ponto" | "risco" | "letra";
  sobe: boolean;
  tam: [number, number];
  vel: [number, number];
  qtd: number;
};
export type Fx = "pulso" | "glitch" | "tremor" | "respira" | "treva";
export type Ambiente = { cor: string; fx: Fx; particula: Particula; drone: number };

const p = (cor: string, forma: Particula["forma"], sobe: boolean, tam: [number, number], vel: [number, number], qtd: number): Particula => ({
  cor, forma, sobe, tam, vel, qtd,
});

export const AMBIENTES: Record<string, Ambiente> = {
  "eco-vazio": { cor: "#c02a2a", fx: "pulso", particula: p("#ff5a3c", "ponto", true, [1, 3], [0.3, 0.9], 55), drone: 55 },
  "maos-que-lembram": { cor: "#bfb8a8", fx: "respira", particula: p("#bfb8a8", "ponto", false, [1, 3], [0.2, 0.6], 70), drone: 62 },
  "sangue-que-nega": { cor: "#6b8f3a", fx: "respira", particula: p("#7ea04a", "risco", false, [4, 8], [0.3, 0.8], 40), drone: 70 },
  "voz-perdida": { cor: "#7aa6c9", fx: "respira", particula: p("#9cc3e0", "ponto", true, [1, 2], [0.15, 0.4], 45), drone: 82 },
  "reflexo-partido": { cor: "#9fd3e6", fx: "glitch", particula: p("#cdeaf5", "risco", false, [6, 14], [0.4, 1.1], 35), drone: 110 },
  "juramento-cinzento": { cor: "#8f8f8f", fx: "respira", particula: p("#9a9a9a", "ponto", false, [1, 3], [0.2, 0.5], 60), drone: 58 },
  "segundo-pacto": { cor: "#8a4fd6", fx: "glitch", particula: p("#a97bff", "ponto", true, [1, 2], [0.2, 0.7], 48), drone: 65 },
  "pagina-que-esquece": { cor: "#d8cfbd", fx: "glitch", particula: p("#d8cfbd", "letra", false, [10, 16], [0.2, 0.5], 32), drone: 75 },
  "sono-roubado": { cor: "#9a8bff", fx: "respira", particula: p("#c1b8ff", "ponto", true, [1, 3], [0.1, 0.3], 50), drone: 49 },
  "fome-eterna": { cor: "#e08a2c", fx: "tremor", particula: p("#ff9d3a", "ponto", true, [1, 3], [0.4, 1.0], 55), drone: 52 },
  "coracao-de-ferro": { cor: "#cfe3f2", fx: "respira", particula: p("#e6f2fa", "ponto", false, [1, 3], [0.3, 0.7], 55), drone: 73 },
  "maos-manchadas": { cor: "#b01818", fx: "pulso", particula: p("#b01818", "risco", false, [6, 12], [0.8, 1.8], 22), drone: 48 },
  "tempo-perdido": { cor: "#d9b45a", fx: "respira", particula: p("#e8c978", "ponto", false, [1, 2], [0.05, 0.2], 60), drone: 80 },
  "fera-interior": { cor: "#d97a1e", fx: "tremor", particula: p("#ffae4d", "ponto", true, [1, 3], [0.4, 1.0], 50), drone: 45 },
  "silencio-divino": { cor: "#f0e2a8", fx: "respira", particula: p("#fff3c4", "ponto", true, [1, 2], [0.05, 0.25], 40), drone: 90 },
  "sombra-viva": { cor: "#6a6a80", fx: "treva", particula: p("#55556a", "ponto", false, [1, 3], [0.1, 0.4], 40), drone: 42 },
  "preco-justo": { cor: "#e0b93c", fx: "respira", particula: p("#f2cd5a", "ponto", false, [1, 3], [0.3, 0.9], 45), drone: 68 },
  "pele-de-vidro": { cor: "#bfe6f0", fx: "glitch", particula: p("#dff4fa", "risco", false, [4, 10], [0.5, 1.2], 40), drone: 120 },
  "ultimo-suspiro": { cor: "#b8c4c0", fx: "treva", particula: p("#c9d4d0", "ponto", true, [2, 5], [0.1, 0.35], 38), drone: 40 },
  "coro-silencioso": { cor: "#8fb0c0", fx: "pulso", particula: p("#a9c8d6", "ponto", true, [1, 3], [0.15, 0.5], 55), drone: 85 },
};

export const AMBIENTE_PADRAO: Ambiente = AMBIENTES["eco-vazio"];
