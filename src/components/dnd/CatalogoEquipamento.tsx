"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Coins, Undo2, X } from "lucide-react";
import { uid } from "@/lib/mesas";
import type { Item } from "@/lib/dnd5e";
import type { ArmaCat, Catalogo, ItemCat, Preco } from "@/lib/regras/dnd5e/catalogo";
import { emOuro, precoEmCobre, proficienteEmArma, proficienteEmArmadura, proficienteEmFerramenta } from "@/lib/regras/dnd5e/equipamento";
import type { Moeda } from "@/lib/regras/dnd5e/catalogo";

const campo = "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const kg = (n: number) => `${String(n).replace(".", ",")} kg`;
const precoTxt = (p?: Preco) => (p ? `${p.valor.toLocaleString("pt-BR")} ${p.moeda}` : "sem preço");
const po = (cobre: number) => `${(cobre / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} po`;

/** Resumo de regra mostrado na lista e guardado na descrição do item. */
export function resumoDoItem(i: ItemCat): string {
  switch (i.tipo) {
    case "arma": {
      const p = i.propriedades;
      const props = [p.acuidade && "acuidade", p.leve && "leve", p.pesada && "pesada", p.alcance && "alcance", p.duasMaos && "duas mãos", p.recarga && "recarga", p.especial && "especial", p.versatil && `versátil (${p.versatil})`, p.arremesso && `arremesso ${p.arremesso.normal}/${p.arremesso.longo} m`, p.municao && `munição ${p.municao.normal}/${p.municao.longo} m`].filter(Boolean).join(", ");
      return `${i.dado ?? "—"} ${i.tipoDano ?? ""}${props ? ` · ${props}` : ""}`.trim();
    }
    case "armadura": return `CA ${i.caBase}${i.somaDes ? ` + Des${i.maxDes !== undefined ? ` (máx. +${i.maxDes})` : ""}` : ""}${i.forca ? ` · For ${i.forca}` : ""}${i.furtividadeDesv ? " · desv. em Furtividade" : ""}`;
    case "escudo": return `+${i.bonusCa} na CA`;
    case "pacote": return i.itens.map((x) => `${x.qtd > 1 ? `${x.qtd}× ` : ""}${x.nome}`).join(", ");
    default: return i.grupo ?? "";
  }
}

const pesoDe = (i: ItemCat) => ("peso" in i ? i.peso : 0);

function itemDaFicha(i: ItemCat, qtd = 1): Item {
  return { id: uid(), nome: i.nome, quantidade: qtd, peso: pesoDe(i), equipado: false, descricao: resumoDoItem(i), catalogoId: i.id };
}

/** Itens da ficha que um item do catálogo gera (pacotes viram vários itens). */
export function itensParaAdicionar(i: ItemCat, cat: Catalogo): Item[] {
  if (i.tipo !== "pacote") return [itemDaFicha(i)];
  return i.itens.map((x) => {
    const ref = x.ref ? cat.item(x.ref) : undefined;
    return ref ? itemDaFicha(ref, x.qtd) : { id: uid(), nome: x.nome, quantidade: x.qtd, peso: 0, equipado: false, descricao: `Do ${i.nome}` };
  });
}

/** Uma compra feita no catálogo: os itens que entraram na ficha e o que custou (em cobre). */
export type Compra = { itens: Item[]; custo: number };

export type ProficienciasEquip = { armas: string[]; armaduras: string[]; ferramentas: string[] };

// ---------- seções do catálogo ----------
type Secao = "armas" | "armaduras" | "aventura" | "ferramentas" | "pacotes";
const SECOES: { id: Secao; rotulo: string }[] = [
  { id: "armas", rotulo: "Armas" }, { id: "armaduras", rotulo: "Armaduras e escudos" }, { id: "aventura", rotulo: "Aventura" },
  { id: "ferramentas", rotulo: "Ferramentas" }, { id: "pacotes", rotulo: "Pacotes" },
];
const secaoDe = (i: ItemCat): Secao => (i.tipo === "arma" ? "armas" : i.tipo === "armadura" || i.tipo === "escudo" ? "armaduras" : i.tipo === "ferramenta" ? "ferramentas" : i.tipo === "pacote" ? "pacotes" : "aventura");

/** Subtítulo do item dentro da seção, com a ordem em que aparece. */
function subtitulo(i: ItemCat): [number, string] {
  switch (i.tipo) {
    case "arma": return [(i.categoria === "simples" ? 0 : 2) + (i.distancia ? 1 : 0), `${i.categoria === "simples" ? "Simples" : "Marciais"} · ${i.distancia ? "à distância" : "corpo a corpo"}`];
    case "armadura": return [{ leve: 0, media: 1, pesada: 2 }[i.categoria], `Armaduras ${{ leve: "leves", media: "médias", pesada: "pesadas" }[i.categoria]}`];
    case "escudo": return [3, "Escudos"];
    case "ferramenta": return [{ "Ferramentas de artesão": 0, "Instrumento musical": 1, "Kit de jogo": 2 }[i.grupo ?? ""] ?? 3, i.grupo === "Instrumento musical" ? "Instrumentos musicais" : i.grupo === "Kit de jogo" ? "Kits de jogo" : i.grupo ?? "Kits e outros"];
    case "item": return [{ Munição: 1, "Foco arcano": 2, "Foco druídico": 3, "Símbolo sagrado": 4 }[i.grupo ?? ""] ?? 0, i.grupo ?? "Equipamento geral"];
    default: return [0, "Pacotes de equipamento"];
  }
}

/** O personagem tem proficiência no item? `undefined` quando o conceito não se aplica (itens de aventura, pacotes). */
function proficiente(i: ItemCat, p: ProficienciasEquip): boolean | undefined {
  if (i.tipo === "arma") return proficienteEmArma(i as ArmaCat, p.armas);
  if (i.tipo === "armadura") return proficienteEmArmadura(i.categoria, p.armaduras);
  if (i.tipo === "escudo") return proficienteEmArmadura("escudo", p.armaduras);
  if (i.tipo === "ferramenta") return proficienteEmFerramenta(i, p.ferramentas);
  return undefined;
}

/**
 * Catálogo de equipamento do livro: seções (armas, armaduras, aventura, ferramentas, pacotes) divididas em subtítulos,
 * busca, filtro por proficiência, saldo e a lista de compras com devolução. Tudo é comprado: nada entra de graça.
 * Quem abre controla as compras (`compras`) e desfaz uma delas em `onDevolver`.
 */
export default function CatalogoEquipamento({ cat, saldo, compras, proficiencias, podePagar, onComprar, onDevolver, onConcluir, onFechar }: {
  cat: Catalogo;
  /** Moedas que o personagem tem agora (mostra o que resta). */
  saldo: Record<Moeda, number>;
  compras: Compra[];
  /** Com a ficha calculada, mostra a proficiência de cada item e liga o filtro. */
  proficiencias?: ProficienciasEquip;
  /** Diz se as moedas cobrem o preço (em peças de cobre). */
  podePagar: (custoCobre: number) => boolean;
  onComprar: (itens: Item[], custoCobre: number) => void;
  onDevolver: (indice: number) => void;
  /** Com isto, aparece "Concluir compra": confirma a lista (quem abriu fecha o catálogo e aplica as compras). */
  onConcluir?: () => void;
  onFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [secao, setSecao] = useState<Secao>("armas");
  const [soProficiente, setSoProficiente] = useState(false);
  const [aviso, setAviso] = useState("");
  // a ficha por trás não rola enquanto o catálogo está aberto (só a lista dentro dele)
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, []);

  const visiveis = useMemo(() => {
    const q = semAcento(texto).trim();
    return cat.equipamento().filter((i) => {
      if (q && !semAcento(i.nome).includes(q)) return false;
      // com o filtro ligado, esconde o que o personagem não sabe usar (itens sem proficiência a conferir continuam)
      if (proficiencias && soProficiente && proficiente(i, proficiencias) === false) return false;
      return true;
    });
  }, [cat, texto, proficiencias, soProficiente]);

  const contagem = useMemo(() => {
    const c: Record<Secao, number> = { armas: 0, armaduras: 0, aventura: 0, ferramentas: 0, pacotes: 0 };
    for (const i of visiveis) c[secaoDe(i)]++;
    return c;
  }, [visiveis]);

  const grupos = useMemo(() => {
    const m = new Map<string, { ordem: number; itens: ItemCat[] }>();
    for (const i of visiveis.filter((x) => secaoDe(x) === secao)) {
      const [ordem, nome] = subtitulo(i);
      if (!m.has(nome)) m.set(nome, { ordem, itens: [] });
      m.get(nome)!.itens.push(i);
    }
    return [...m.entries()].sort((a, b) => a[1].ordem - b[1].ordem);
  }, [visiveis, secao]);

  const gasto = compras.reduce((t, c) => t + c.custo, 0);
  const comprar = (i: ItemCat, custo: number) => {
    onComprar(itensParaAdicionar(i, cat), custo);
    setAviso(`${i.nome} comprado${custo ? ` por ${po(custo)}` : ""}.`);
  };
  const devolver = (k: number) => {
    const c = compras[k];
    onDevolver(k);
    setAviso(`Compra cancelada: ${c.itens.map((x) => x.nome).join(", ")}${c.custo ? ` (+${po(c.custo)})` : ""}.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/60 p-3" role="dialog" aria-modal="true" aria-label="Catálogo de equipamento">
      <div className="flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-gold/50 bg-card shadow-xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="font-display text-lg font-bold text-gold">Catálogo de equipamento</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-0.5 text-sm" title="Quanto ainda resta nas moedas">
            <Coins size={14} className="text-gold" aria-hidden /> Resta <strong className="text-gold">{emOuro(saldo).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} po</strong>
          </span>
          <button onClick={onFechar} aria-label="Fechar" className="ml-auto rounded-lg p-1.5 text-muted hover:text-foreground"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-sm">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar pelo nome…" aria-label="Buscar item" className={`${campo} min-w-40 flex-1`} autoFocus />
          {proficiencias && (
            <label className="flex items-center gap-1.5 text-xs text-muted" title="Proficiência: o personagem sabe usar o item (soma o bônus de proficiência). Sem ela, armas perdem o bônus no ataque e armaduras dão desvantagem em testes de Força e Destreza e impedem magias.">
              <input type="checkbox" checked={soProficiente} onChange={(e) => setSoProficiente(e.target.checked)} />
              Só com proficiência
            </label>
          )}
        </div>

        <nav role="tablist" aria-label="Seções do catálogo" className="flex flex-wrap gap-1 border-b border-border px-4 pt-2">
          {SECOES.map((s) => (
            <button
              key={s.id} role="tab" aria-selected={secao === s.id} onClick={() => setSecao(s.id)}
              className={`rounded-t-lg border border-b-0 px-3 py-1.5 text-sm ${secao === s.id ? "border-gold/60 bg-card-2 font-semibold text-gold" : "border-border text-muted hover:text-foreground"}`}
            >
              {s.rotulo} <span className="text-[10px] opacity-70">{contagem[s.id]}</span>
            </button>
          ))}
        </nav>

        <p role="status" aria-live="polite" className={`flex items-center gap-1.5 px-4 text-xs ${aviso ? "py-1.5 text-ok" : "h-0 overflow-hidden"}`}>
          {aviso && <><Check size={13} aria-hidden /> {aviso}</>}
        </p>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="min-h-0 flex-[3] overflow-y-auto overscroll-contain text-sm lg:flex-1">
            {grupos.length === 0 && <p className="px-4 py-4 text-muted">Nada encontrado nesta seção.</p>}
            {grupos.map(([nome, { itens }]) => (
              <section key={nome}>
                <h3 className="sticky top-0 z-10 border-b border-gold/20 bg-card px-4 py-1 font-display text-xs font-semibold uppercase tracking-[0.18em] text-gold">{nome} <span className="font-normal text-muted">({itens.length})</span></h3>
                <ul className="divide-y divide-border">
                  {itens.map((i) => {
                    const custo = precoEmCobre("preco" in i ? i.preco : undefined);
                    const pr = proficiencias ? proficiente(i, proficiencias) : undefined;
                    const pode = podePagar(custo);
                    return (
                      <li key={i.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {i.nome} <span className="text-xs font-normal text-muted">{precoTxt("preco" in i ? i.preco : undefined)}{pesoDe(i) ? ` · ${kg(pesoDe(i))}` : ""}</span>
                            {pr !== undefined && <span className={`ml-2 rounded-full border px-1.5 text-[10px] font-normal ${pr ? "border-ok/50 text-ok" : "border-danger/40 text-danger"}`}>{pr ? "proficiente" : "sem proficiência"}</span>}
                          </p>
                          <p className="truncate text-xs text-muted" title={resumoDoItem(i)}>{resumoDoItem(i)}</p>
                        </div>
                        <button disabled={!pode} onClick={() => comprar(i, custo)} className="rounded-md border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/20 disabled:opacity-40" title={pode ? "Compra e desconta o preço das moedas" : "Moedas insuficientes"}>Comprar</button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <aside className="flex min-h-0 flex-[2] flex-col overflow-hidden border-t border-border bg-background/40 lg:w-72 lg:flex-none lg:border-l lg:border-t-0" aria-label="Lista de compras">
            <h3 className="shrink-0 border-b border-gold/20 bg-card px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.18em] text-gold">Lista de compras</h3>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {compras.length === 0 ? <p className="px-4 py-3 text-xs text-muted">Nada comprado ainda.</p> : (
              <ul className="divide-y divide-border text-sm">
                {compras.map((c, k) => (
                  <li key={k} className="flex items-start gap-2 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words">{c.itens.map((x) => `${x.quantidade > 1 ? `${x.quantidade}× ` : ""}${x.nome}`).join(", ")}</p>
                      <p className="text-xs text-muted">{c.custo ? po(c.custo) : "sem custo"}</p>
                    </div>
                    <button onClick={() => devolver(k)} aria-label={`Cancelar a compra de ${c.itens.map((x) => x.nome).join(", ")}`} title="Cancelar a compra e recuperar o dinheiro" className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-danger hover:text-danger"><Undo2 size={11} aria-hidden />cancelar</button>
                  </li>
                ))}
              </ul>
            )}
            </div>
            <dl className="shrink-0 space-y-0.5 border-t border-border px-4 py-2 text-xs">
              <div className="flex justify-between"><dt className="text-muted">Gasto</dt><dd className="font-semibold">{po(gasto)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Resta</dt><dd className="font-semibold text-gold">{emOuro(saldo).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} po</dd></div>
            </dl>
            {onConcluir && (
              <div className="shrink-0 border-t border-border p-3">
                <button onClick={onConcluir} className="w-full rounded-lg border border-gold bg-gold/15 px-3 py-2 text-sm font-semibold text-gold hover:bg-gold/25">
                  Concluir compra{compras.length ? ` (${compras.length} ${compras.length === 1 ? "item" : "itens"}, ${po(gasto)})` : ""}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
