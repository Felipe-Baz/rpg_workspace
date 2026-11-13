"use client";

import { useRef, useState } from "react";
import Markdown from "./Markdown";

type Modo = "escrever" | "dividido" | "visualizar";

type Ed = {
  envolver: (antes: string, depois: string, exemplo: string) => void;
  prefixo: (p: string | ((i: number) => string)) => void;
  bloco: (texto: string, selecionar?: string) => void;
};

type Acao = { rotulo: string; titulo: string; run: (e: Ed) => void };

const GRUPOS: Acao[][] = [
  [
    { rotulo: "H1", titulo: "Título", run: (e) => e.prefixo("# ") },
    { rotulo: "H2", titulo: "Subtítulo", run: (e) => e.prefixo("## ") },
    { rotulo: "H3", titulo: "Seção", run: (e) => e.prefixo("### ") },
  ],
  [
    { rotulo: "B", titulo: "Negrito (Ctrl+B)", run: (e) => e.envolver("**", "**", "negrito") },
    { rotulo: "I", titulo: "Itálico (Ctrl+I)", run: (e) => e.envolver("*", "*", "itálico") },
    { rotulo: "S", titulo: "Riscado", run: (e) => e.envolver("~~", "~~", "riscado") },
    { rotulo: "<>", titulo: "Código em linha", run: (e) => e.envolver("`", "`", "código") },
  ],
  [
    { rotulo: "• Lista", titulo: "Lista com marcadores", run: (e) => e.prefixo("- ") },
    { rotulo: "1. Lista", titulo: "Lista numerada", run: (e) => e.prefixo((i) => `${i + 1}. `) },
    { rotulo: "☑", titulo: "Lista de tarefas", run: (e) => e.prefixo("- [ ] ") },
    { rotulo: "❝", titulo: "Citação", run: (e) => e.prefixo("> ") },
  ],
  [
    { rotulo: "Link", titulo: "Link (Ctrl+K)", run: (e) => e.envolver("[", "](https://)", "texto") },
    { rotulo: "Img", titulo: "Imagem", run: (e) => e.envolver("![", "](https://)", "descrição") },
    { rotulo: "{ }", titulo: "Bloco de código", run: (e) => e.bloco("```\ncódigo\n```", "código") },
    {
      rotulo: "Tabela",
      titulo: "Tabela",
      run: (e) => e.bloco("| Coluna 1 | Coluna 2 |\n| --- | --- |\n| a | b |", "Coluna 1"),
    },
    { rotulo: "―", titulo: "Linha horizontal", run: (e) => e.bloco("---") },
  ],
];

export default function EditorMarkdown({
  valor,
  onChange,
  placeholder,
  desabilitado,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  desabilitado?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [modo, setModo] = useState<Modo>("escrever");

  function aplicar(novo: string, ini: number, fim: number) {
    onChange(novo);
    requestAnimationFrame(() => {
      const t = ref.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(ini, fim);
    });
  }

  const ed: Ed = {
    envolver(antes, depois, exemplo) {
      const t = ref.current;
      if (!t) return;
      const { selectionStart: a, selectionEnd: b } = t;
      const sel = valor.slice(a, b) || exemplo;
      aplicar(
        valor.slice(0, a) + antes + sel + depois + valor.slice(b),
        a + antes.length,
        a + antes.length + sel.length,
      );
    },
    prefixo(p) {
      const t = ref.current;
      if (!t) return;
      const { selectionStart: a, selectionEnd: b } = t;
      const ini = valor.lastIndexOf("\n", a - 1) + 1;
      let fimLinha = valor.indexOf("\n", b);
      if (fimLinha === -1) fimLinha = valor.length;
      const linhas = valor.slice(ini, fimLinha).split("\n");
      const novo = linhas
        .map((l, i) => {
          const pre = typeof p === "string" ? p : p(i);
          // alterna: se já tem o prefixo, remove; títulos trocam de nível
          if (l.startsWith(pre)) return l.slice(pre.length);
          return pre + (pre.startsWith("#") ? l.replace(/^#{1,6}\s+/, "") : l);
        })
        .join("\n");
      aplicar(valor.slice(0, ini) + novo + valor.slice(fimLinha), ini, ini + novo.length);
    },
    bloco(texto, selecionar) {
      const t = ref.current;
      if (!t) return;
      const { selectionStart: a, selectionEnd: b } = t;
      const antes = valor.slice(0, a);
      const lead = antes && !antes.endsWith("\n\n") ? (antes.endsWith("\n") ? "\n" : "\n\n") : "";
      const pos = a + lead.length + (selecionar ? texto.indexOf(selecionar) : texto.length);
      aplicar(antes + lead + texto + "\n" + valor.slice(b), pos, pos + (selecionar?.length ?? 0));
    },
  };

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const t = e.currentTarget;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === "b") {
        e.preventDefault();
        ed.envolver("**", "**", "negrito");
      } else if (k === "i") {
        e.preventDefault();
        ed.envolver("*", "*", "itálico");
      } else if (k === "k") {
        e.preventDefault();
        ed.envolver("[", "](https://)", "texto");
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const a = t.selectionStart;
      aplicar(valor.slice(0, a) + "  " + valor.slice(t.selectionEnd), a + 2, a + 2);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      // continua listas, tarefas e citações
      const a = t.selectionStart;
      const ini = valor.lastIndexOf("\n", a - 1) + 1;
      const m = valor.slice(ini, a).match(/^(\s*)(- \[[ x]\] |[-*+] |\d+\. |> )(.*)$/);
      if (!m) return;
      e.preventDefault();
      if (!m[3]) {
        aplicar(valor.slice(0, ini) + valor.slice(a), ini, ini); // item vazio encerra a lista
        return;
      }
      let marca = m[2];
      if (/^\d+\. $/.test(marca)) marca = `${parseInt(marca) + 1}. `;
      if (marca.startsWith("- [")) marca = "- [ ] ";
      const ins = "\n" + m[1] + marca;
      aplicar(valor.slice(0, a) + ins + valor.slice(t.selectionEnd), a + ins.length, a + ins.length);
    }
  }

  const botao = "rounded px-2 py-1 text-xs font-medium hover:bg-border/60 disabled:opacity-40";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border bg-card px-2 py-1">
        {GRUPOS.map((g, gi) => (
          <div key={gi} className="flex items-center gap-0.5 border-r border-border pr-1 last:border-r-0">
            {g.map((a) => (
              <button
                key={a.rotulo}
                type="button"
                title={a.titulo}
                disabled={desabilitado || modo === "visualizar"}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => a.run(ed)}
                className={botao}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
        ))}
        <div className="ml-auto flex gap-0.5">
          {(["escrever", "dividido", "visualizar"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`${botao} capitalize ${modo === m ? "bg-violet-600 text-white hover:bg-violet-600" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className={modo === "dividido" ? "grid md:grid-cols-2 md:divide-x md:divide-border" : ""}>
        {modo !== "visualizar" && (
          <textarea
            ref={ref}
            value={valor}
            disabled={desabilitado}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={aoTeclar}
            placeholder={placeholder}
            rows={12}
            spellCheck
            className="block min-h-64 w-full resize-y bg-transparent p-3 font-mono text-sm outline-none"
          />
        )}
        {modo !== "escrever" && (
          <div className="min-h-64 p-3">
            {valor.trim() ? (
              <Markdown texto={valor} />
            ) : (
              <p className="text-sm text-muted">Nada para mostrar ainda.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
