"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Lightbulb, type LucideIcon } from "lucide-react";

/**
 * Campo de texto longo da ficha (personalidade, ideais, anotações...): cabeçalho com ícone, papel pautado, altura que
 * acompanha o texto e contador. Com `sugestoes` (ex.: as do antecedente do livro), um botão lista frases para anexar.
 */
export default function CampoLongo({ rotulo, icone: Icone, dica, valor, onChange, linhas = 3, sugestoes }: {
  rotulo: string;
  icone?: LucideIcon;
  /** texto de apoio quando vazio */
  dica?: string;
  valor: string;
  onChange: (v: string) => void;
  /** altura mínima, em linhas */
  linhas?: number;
  sugestoes?: string[];
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [abrirSugestoes, setAbrirSugestoes] = useState(false);

  // a altura acompanha o conteúdo (sem barra de rolagem interna)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [valor, linhas]);

  const anexar = (frase: string) => onChange(valor.trim() ? `${valor.replace(/\s+$/, "")}\n${frase}` : frase);

  return (
    <div className="campo-longo">
      <div className="campo-longo-cab">
        <label htmlFor={id} className="campo-longo-rotulo">
          {Icone && <Icone size={14} aria-hidden />}
          {rotulo}
        </label>
        {sugestoes && sugestoes.length > 0 && (
          <button type="button" onClick={() => setAbrirSugestoes((v) => !v)} aria-expanded={abrirSugestoes} className="campo-longo-sug">
            <Lightbulb size={12} aria-hidden /> Sugestões
          </button>
        )}
      </div>
      {abrirSugestoes && sugestoes && (
        <ul className="campo-longo-lista" aria-label={`Sugestões de ${rotulo.toLowerCase()}`}>
          {sugestoes.map((s, k) => (
            <li key={k}><button type="button" onClick={() => anexar(s)} title="Adicionar ao campo">{s}</button></li>
          ))}
        </ul>
      )}
      <textarea
        id={id} ref={ref} value={valor} rows={linhas} placeholder={dica}
        onChange={(e) => onChange(e.target.value)}
        className="campo-longo-texto"
      />
      <p className="campo-longo-rodape">{valor.trim() ? `${valor.trim().split(/\s+/).length} palavras` : "vazio"}</p>
    </div>
  );
}
