"use client";

import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { slug } from "@/lib/livros";

type ComFilhos = { children?: ReactNode };

const textoDe = (n: ReactNode): string =>
  Children.toArray(n)
    .map((c) => (typeof c === "string" || typeof c === "number" ? String(c) : isValidElement<ComFilhos>(c) ? textoDe(c.props.children) : ""))
    .join("");

/**
 * Texto de livro: títulos internos com âncora (o sumário da seção leva até eles), tabelas roláveis, citações viram
 * destaque. Os cabeçalhos do markdown são rebaixados porque o título da seção já é o h2 da página.
 */
export default function LivroMarkdown({ texto }: { texto: string }) {
  const componentes: Components = {
    h1: (p) => <h3 id={slug(textoDe(p.children))} className="livro-h3">{p.children}</h3>,
    h2: (p) => <h3 id={slug(textoDe(p.children))} className="livro-h3">{p.children}</h3>,
    h3: (p) => <h3 id={slug(textoDe(p.children))} className="livro-h3">{p.children}</h3>,
    h4: (p) => <h4 id={slug(textoDe(p.children))} className="livro-h4">{p.children}</h4>,
    h5: (p) => <h4 id={slug(textoDe(p.children))} className="livro-h4">{p.children}</h4>,
    h6: (p) => <h4 id={slug(textoDe(p.children))} className="livro-h4">{p.children}</h4>,
    table: (p) => <div className="livro-tabela"><table>{p.children}</table></div>,
    a: (p) => <a href={p.href} target="_blank" rel="noopener noreferrer" className="text-accent underline">{p.children}</a>,
  };
  return (
    <div className="livro-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>{texto}</ReactMarkdown>
    </div>
  );
}
