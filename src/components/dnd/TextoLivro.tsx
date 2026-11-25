"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Texto do livro (traços, características, antecedentes) com o markdown da fonte formatado: subtítulos "#####",
 * negrito, listas e tabelas. Substitui o texto cortado/cru nas telas.
 */
export default function TextoLivro({ texto, className = "" }: { texto: string; className?: string }) {
  return (
    <div className={`texto-livro space-y-2 text-xs leading-relaxed text-muted ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h4 className="mt-2 font-display text-sm font-semibold text-gold">{children}</h4>,
          h2: ({ children }) => <h4 className="mt-2 font-display text-sm font-semibold text-gold">{children}</h4>,
          h3: ({ children }) => <h4 className="mt-2 font-display text-sm font-semibold text-gold">{children}</h4>,
          h4: ({ children }) => <h5 className="mt-2 border-b border-gold/20 pb-0.5 font-display text-xs font-semibold uppercase tracking-wider text-gold">{children}</h5>,
          h5: ({ children }) => <h5 className="mt-2 border-b border-gold/20 pb-0.5 font-display text-xs font-semibold uppercase tracking-wider text-gold">{children}</h5>,
          h6: ({ children }) => <h5 className="mt-2 font-semibold text-foreground">{children}</h5>,
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-gold/40 pl-3 italic">{children}</blockquote>,
          table: ({ children }) => <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-[11px]">{children}</table></div>,
          th: ({ children }) => <th className="border-b border-gold/30 px-1.5 py-0.5 font-semibold text-foreground">{children}</th>,
          td: ({ children }) => <td className="border-b border-border px-1.5 py-0.5">{children}</td>,
        }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
