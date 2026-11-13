"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renderiza markdown (GFM: tabelas, checklists, riscado). HTML cru é ignorado. */
export default function Markdown({ texto }: { texto: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: (p) => <a {...p} target="_blank" rel="noopener noreferrer" /> }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
