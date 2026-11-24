// Som da rolagem (`public/sons/lancamento_de_dados.mp3`). O jogador pode silenciar; a escolha fica neste navegador.
const ARQUIVO = "/sons/lancamento_de_dados.mp3";
const CHAVE = "dados-som";

let base: HTMLAudioElement | null = null;

export function somAtivo(): boolean {
  try { return localStorage.getItem(CHAVE) !== "0"; } catch { return true; }
}

export function definirSom(ligado: boolean) {
  try { localStorage.setItem(CHAVE, ligado ? "1" : "0"); } catch {}
}

function carregar(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!base) { base = new Audio(ARQUIVO); base.preload = "auto"; }
  return base;
}

/** Começa a baixar o som antes da primeira rolagem (evita atraso no primeiro lançamento). */
export const precarregarSom = () => { carregar(); };

/** Duração do som em ms (ou `null` se ainda não carregou): a animação do dado acompanha. */
export function duracaoSom(): number | null {
  const d = carregar()?.duration;
  return d && Number.isFinite(d) ? d * 1000 : null;
}

/** Toca o som do lançamento. Navegadores podem bloquear áudio sem interação prévia: nesse caso fica mudo, sem erro. */
export function tocarLancamento() {
  if (!somAtivo()) return;
  const b = carregar();
  if (!b) return;
  try {
    const a = b.cloneNode(true) as HTMLAudioElement; // clone permite rolagens seguidas sobrepostas
    a.volume = 0.9;
    void a.play().catch(() => {});
  } catch {}
}
