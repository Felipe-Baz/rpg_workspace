import { Eye, Flame, Heart, RefreshCw, Shield, Skull, Sparkles, Theater, type LucideIcon } from "lucide-react";

// Ornamentos do tema de ficha. Todos são decorativos ou redundantes com texto (aria-hidden): a informação
// (valor, escola, círculo) sempre aparece também em texto. Ícones: lucide (ISC); o resto é SVG/CSS próprio.

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cor de cada escola de magia (borda e selo da carta). Contraste testado sobre o fundo escuro e o pergaminho. */
export const COR_ESCOLA: Record<string, string> = {
  abjuracao: "#4f8bd6", adivinhacao: "#8e7cc3", conjuracao: "#d9a441", encantamento: "#d96ba0",
  evocacao: "#e0573d", ilusao: "#4fb3bb", necromancia: "#6b9a55", transmutacao: "#b7774a",
};
const ICONE_ESCOLA: Record<string, LucideIcon> = {
  abjuracao: Shield, adivinhacao: Eye, conjuracao: Sparkles, encantamento: Heart,
  evocacao: Flame, ilusao: Theater, necromancia: Skull, transmutacao: RefreshCw,
};
export const chaveEscola = (escola: string) => semAcento(escola).trim();
export const corDaEscola = (escola: string) => COR_ESCOLA[chaveEscola(escola)] ?? "var(--gold)";

export function IconeEscola({ escola, size = 14 }: { escola: string; size?: number }) {
  const Icone = ICONE_ESCOLA[chaveEscola(escola)];
  return Icone ? <Icone size={size} aria-hidden style={{ color: "var(--escola, var(--gold))" }} /> : null;
}

/** Escudo da classe de armadura: o número fica em texto, o desenho é só moldura. */
export function Escudo({ valor, titulo }: { valor: number; titulo?: string }) {
  return (
    <div className="escudo" title={titulo}>
      <svg viewBox="0 0 64 76" aria-hidden className="escudo-svg">
        <path d="M32 3 59 12v24c0 18-12 31-27 37C17 67 5 54 5 36V12z" className="escudo-fundo" />
        <path d="M32 9 53 16v20c0 14-9 25-21 31C20 61 11 50 11 36V16z" className="escudo-miolo" />
        <path d="M32 9v58" className="escudo-linha" />
      </svg>
      <span className="escudo-valor">{valor}</span>
    </div>
  );
}

/** Medalhão hexagonal de atributo: o bônus é o botão de rolagem; o valor fica abaixo. */
export function Medalhao({ children }: { children: React.ReactNode }) {
  return (
    <div className="medalhao">
      <div className="medalhao-miolo">{children}</div>
    </div>
  );
}

/** Gema de espaço de magia: acesa = disponível, apagada = gasta. */
export function Gema({ gasta, rotulo, onClick }: { gasta: boolean; rotulo: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} aria-pressed={gasta} className="gema-botao" title={gasta ? "Gasto (clique para recuperar)" : "Disponível (clique para gastar)"}>
      <span className={`gema ${gasta ? "gema-gasta" : ""}`} aria-hidden />
    </button>
  );
}

/** Marca de proficiência em perícia: vazio, losango cheio (proficiente) ou losango duplo (especialista). */
export function Losango({ nivel, rotulo, onClick, titulo }: { nivel: 0 | 1 | 2; rotulo: string; onClick: () => void; titulo?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={rotulo} title={titulo} className="losango-botao">
      <span className={`losango losango-${nivel}`} aria-hidden />
    </button>
  );
}
