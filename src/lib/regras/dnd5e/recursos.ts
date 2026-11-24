// Recursos com usos (Fúria, Ki, Canalizar Divindade...), o tipo de recarga e as rolagens que eles geram.
// A ficha guarda só os usos gastos (`recursos[id]`); o máximo vem da classe, do nível e dos atributos.

import { classesDaFicha, modificador, nivelNaClasse, type FichaDnd, type Teste } from "../../dnd5e.ts";
import { ATIVAVEIS, danoDeFuria } from "./combate.ts";

export type Recarga = "curto" | "longo";
export type RecursoDef = {
  id: string;
  nome: string;
  max: number;
  /** Sem limite de usos (Fúria e Forma Selvagem no 20º nível). */
  ilimitado?: boolean;
  recarga: Recarga;
  fonte: string;
  descricao: string;
  /** Reserva grande (pontos de vida da Imposição das Mãos): gasta-se uma quantidade por vez. */
  reserva?: boolean;
  /** Rolagem associada (Retomar o Fôlego, Inspiração de Bardo). */
  rolagem?: { titulo: string; dado: string; partes: { rotulo: string; valor: number }[]; cura?: boolean };
};
export type RecursoCalculado = RecursoDef & { usados: number; restantes: number };

const mod = (f: FichaDnd, a: keyof FichaDnd["atributos"]) => modificador(f.atributos[a]);
const porNivel = (nivel: number, faixas: [number, number][]) => faixas.reduce((v, [de, valor]) => (nivel >= de ? valor : v), 0);

/** Recursos da classe (e de raça/talento informados) para a ficha efetiva. Fichas sem classe não têm recursos. */
export function recursosDaFicha(f: FichaDnd, extras: { racaId?: string; talentos?: string[] } = {}): RecursoDef[] {
  const out: RecursoDef[] = [];
  // cada classe dá os recursos do SEU nível (multiclasse: guerreiro 5 / mago 3 tem Surto de Ação de guerreiro 5 e Recuperação Arcana de mago 3)
  for (const { id: classe, nivel: n } of classesDaFicha(f)) switch (classe) {
    case "barbaro":
      out.push({ id: "furia", nome: "Fúria", max: porNivel(n, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]), ilimitado: n >= 20, recarga: "longo", fonte: "Bárbaro", descricao: `Dura 1 minuto. Dano de fúria +${danoDeFuria(n)}.` });
      break;
    case "bardo":
      out.push({
        id: "inspiracao-de-bardo", nome: "Inspiração de Bardo", max: Math.max(1, mod(f, "car")), recarga: n >= 5 ? "curto" : "longo", fonte: "Bardo",
        descricao: `Dado d${n >= 15 ? 12 : n >= 10 ? 10 : n >= 5 ? 8 : 6} concedido a um aliado.`,
        rolagem: { titulo: "Inspiração de Bardo", dado: `1d${n >= 15 ? 12 : n >= 10 ? 10 : n >= 5 ? 8 : 6}`, partes: [] },
      });
      break;
    case "clerigo":
      if (n >= 2) out.push({ id: "canalizar-divindade", nome: "Canalizar Divindade", max: n >= 18 ? 3 : n >= 6 ? 2 : 1, recarga: "curto", fonte: "Clérigo", descricao: "Expulsar mortos-vivos e a opção do seu domínio." });
      break;
    case "druida":
      if (n >= 2) out.push({ id: "forma-selvagem", nome: "Forma Selvagem", max: 2, ilimitado: n >= 20, recarga: "curto", fonte: "Druida", descricao: "Transformar-se numa fera." });
      break;
    case "feiticeiro":
      if (n >= 2) out.push({ id: "pontos-de-feiticaria", nome: "Pontos de Feitiçaria", max: n, recarga: "longo", fonte: "Feiticeiro", descricao: "Convertem-se em espaços de magia e metamagia." });
      break;
    case "guerreiro":
      out.push({ id: "retomar-o-folego", nome: "Retomar o Fôlego", max: 1, recarga: "curto", fonte: "Guerreiro", descricao: "Ação bônus: recupera 1d10 + nível PV.", rolagem: { titulo: "Retomar o Fôlego", dado: "1d10", partes: [{ rotulo: "Nível de guerreiro", valor: n }], cura: true } });
      if (n >= 2) out.push({ id: "surto-de-acao", nome: "Surto de Ação", max: n >= 17 ? 2 : 1, recarga: "curto", fonte: "Guerreiro", descricao: "Uma ação adicional no seu turno." });
      if (n >= 9) out.push({ id: "indomavel", nome: "Indomável", max: n >= 17 ? 3 : n >= 13 ? 2 : 1, recarga: "longo", fonte: "Guerreiro", descricao: "Repete uma salvaguarda falha, com bônus igual ao nível." });
      break;
    case "mago":
      out.push({ id: "recuperacao-arcana", nome: "Recuperação Arcana", max: 1, recarga: "longo", fonte: "Mago", descricao: `Recupera espaços de magia somando até ${Math.ceil(n / 2)} círculos (nenhum de 6º ou maior), num descanso curto.` });
      break;
    case "monge":
      if (n >= 2) out.push({ id: "pontos-de-ki", nome: "Pontos de Ki", max: n, recarga: "curto", fonte: "Monge", descricao: "Rajada de golpes, defesa paciente e passo do vento." });
      break;
    case "paladino":
      out.push({ id: "imposicao-das-maos", nome: "Imposição das Mãos", max: 5 * n, reserva: true, recarga: "longo", fonte: "Paladino", descricao: "Reserva de pontos de vida para curar (5 por nível)." });
      out.push({ id: "sentido-divino", nome: "Sentido Divino", max: 1 + Math.max(0, mod(f, "car")), recarga: "longo", fonte: "Paladino", descricao: "Detecta celestiais, corruptores e mortos-vivos próximos." });
      break;
    default:
  }
  if (extras.racaId === "draconato") out.push({ id: "arma-de-sopro", nome: "Arma de Sopro", max: 1, recarga: "curto", fonte: "Draconato", descricao: "Dano pelo ancestral dracônico; CD 8 + Con + proficiência." });
  if (extras.talentos?.includes("sortudo")) out.push({ id: "pontos-de-sorte", nome: "Pontos de Sorte", max: 3, recarga: "longo", fonte: "Sortudo", descricao: "Rolar um d20 adicional em ataques, testes ou salvaguardas." });
  return out;
}

/** Defs com os usos gastos e o que resta. */
export function recursosCalculados(f: FichaDnd, defs: readonly RecursoDef[]): RecursoCalculado[] {
  return defs.map((d) => {
    const usados = Math.min(Math.max(0, f.recursos?.[d.id] ?? 0), d.max);
    return { ...d, usados, restantes: d.ilimitado ? d.max : d.max - usados };
  });
}

/** Gasta `qtd` usos (ou devolve, com qtd negativa). Passa a ficha igual se não houver o que gastar. */
export function gastarRecurso(f: FichaDnd, defs: readonly RecursoDef[], id: string, qtd = 1): FichaDnd {
  const d = defs.find((x) => x.id === id);
  if (!d) return f;
  if (d.ilimitado && qtd > 0) return f;
  const atual = f.recursos?.[id] ?? 0;
  const novo = Math.min(d.max, Math.max(0, atual + qtd));
  if (novo === atual || (qtd > 0 && atual >= d.max)) return f;
  return { ...f, recursos: { ...f.recursos, [id]: novo } };
}

/** Descanso: o curto devolve os recursos de recarga curta; o longo devolve todos. As características ligadas se encerram. */
export function restaurarRecursos(f: FichaDnd, defs: readonly RecursoDef[], descanso: Recarga): FichaDnd {
  const recursos = { ...f.recursos };
  for (const d of defs) if (descanso === "longo" || d.recarga === "curto") delete recursos[d.id];
  return { ...f, recursos, ativos: [] };
}

/** Pode ligar a característica? Gasta o recurso que ela usa. `null` quando falta recurso. */
export function ligarAtivavel(f: FichaDnd, defs: readonly RecursoDef[], id: string): FichaDnd | null {
  const a = ATIVAVEIS.find((x) => x.id === id);
  if (!a) return null;
  let novo = f;
  if (a.usaRecurso) {
    novo = gastarRecurso(f, defs, a.usaRecurso, 1);
    if (novo === f && !defs.find((d) => d.id === a.usaRecurso)?.ilimitado) return null;
  }
  return { ...novo, ativos: [...new Set([...(novo.ativos ?? []), id])] };
}
export const desligarAtivavel = (f: FichaDnd, id: string): FichaDnd => ({ ...f, ativos: (f.ativos ?? []).filter((x) => x !== id) });

/** Ataque Furtivo do ladino: metade do nível (arredondada para cima) em d6. */
export function testeAtaqueFurtivo(f: FichaDnd): Teste | null {
  const n = nivelNaClasse(f, "ladino");
  if (!n) return null;
  return { titulo: "Ataque Furtivo", dado: `${Math.ceil(n / 2)}d6`, d20: false, dano: true, partes: [] };
}

/** Cura da Imposição das Mãos: gasta `pv` da reserva e devolve a quantidade a curar. */
export function imposicaoDasMaos(f: FichaDnd, defs: readonly RecursoDef[], pv: number): FichaDnd | null {
  const r = recursosCalculados(f, defs).find((x) => x.id === "imposicao-das-maos");
  if (!r || pv <= 0 || pv > r.restantes) return null;
  return gastarRecurso(f, defs, r.id, pv);
}
