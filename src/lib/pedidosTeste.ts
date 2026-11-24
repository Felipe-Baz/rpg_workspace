// Pedidos de teste do mestre a um jogador: `mesas/{id}/pedidosTeste/{pedidoId}`.
// O mestre cria (perícia, atributo, salvaguarda ou teste livre); o jogador alvo vê o pedido na tela, rola e a resposta
// volta no mesmo documento. Puro/Firestore: a interface fica em components/sessao/PedirTeste e components/dnd/PedidoTesteJogador.
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { ATRIBUTO_NOME, PERICIAS, type Atributo, type PericiaId } from "./dnd5e";

export type TipoPedido = "pericia" | "atributo" | "salvaguarda" | "iniciativa" | "livre";
export type Vantagem = "v" | "d" | null;

export type PedidoTeste = {
  id: string;
  paraUid: string;
  paraNome: string;
  tipo: TipoPedido;
  /** Id da perícia, sigla do atributo ou, no teste livre, o nome digitado pelo mestre. */
  chave: string;
  vantagem: Vantagem;
  motivo: string;
  status: "pendente" | "respondido";
  /** Total final (d20 + bônus). Só existe depois de respondido. */
  total?: number;
  /** Valor do d20 que ficou (natural), para o mestre ver 20 e 1 naturais. */
  natural?: number;
  /** Como o jogador rolou: no site (dados 3D) ou na mesa (informado à mão). */
  origem?: "site" | "mesa";
  criadoEm: number;
};

export const MAX_PEDIDOS = 20;

/** Nome legível do teste ("Sobrevivência", "Salvaguarda de Destreza"…). */
export function tituloPedido(p: Pick<PedidoTeste, "tipo" | "chave">): string {
  if (p.tipo === "pericia") return PERICIAS.find((x) => x.id === p.chave)?.nome ?? p.chave;
  if (p.tipo === "atributo") return `Teste de ${ATRIBUTO_NOME[p.chave as Atributo] ?? p.chave}`;
  if (p.tipo === "iniciativa") return "Iniciativa";
  if (p.tipo === "salvaguarda") return `Salvaguarda de ${ATRIBUTO_NOME[p.chave as Atributo] ?? p.chave}`;
  return p.chave || "Teste";
}

export const periciaValida = (id: string): id is PericiaId => PERICIAS.some((p) => p.id === id);

const col = (mesaId: string) => collection(db, "mesas", mesaId, "pedidosTeste");

function ler(id: string, x: Record<string, unknown>): PedidoTeste {
  return {
    id,
    paraUid: String(x.paraUid ?? ""),
    paraNome: String(x.paraNome ?? ""),
    tipo: (["pericia", "atributo", "salvaguarda", "iniciativa", "livre"].includes(String(x.tipo)) ? x.tipo : "livre") as TipoPedido,
    chave: String(x.chave ?? ""),
    vantagem: x.vantagem === "v" || x.vantagem === "d" ? x.vantagem : null,
    motivo: String(x.motivo ?? ""),
    status: x.status === "respondido" ? "respondido" : "pendente",
    total: typeof x.total === "number" ? x.total : undefined,
    natural: typeof x.natural === "number" ? x.natural : undefined,
    origem: x.origem === "mesa" ? "mesa" : x.origem === "site" ? "site" : undefined,
    criadoEm: Number(x.criadoEm ?? 0),
  };
}

export async function pedirTeste(mesaId: string, p: Omit<PedidoTeste, "id" | "status" | "criadoEm" | "total" | "natural" | "origem">) {
  const id = crypto.randomUUID();
  await setDoc(doc(db, "mesas", mesaId, "pedidosTeste", id), {
    paraUid: p.paraUid,
    paraNome: p.paraNome.slice(0, 60),
    tipo: p.tipo,
    chave: p.chave.slice(0, 60),
    vantagem: p.vantagem,
    motivo: p.motivo.slice(0, 200),
    status: "pendente",
    criadoEm: Date.now(),
  });
}

export async function responderPedido(mesaId: string, id: string, r: { total: number; natural: number; origem: "site" | "mesa" }) {
  await updateDoc(doc(db, "mesas", mesaId, "pedidosTeste", id), { status: "respondido", total: r.total, natural: r.natural, origem: r.origem, respondidoEm: Date.now() });
}

export const removerPedido = (mesaId: string, id: string) => deleteDoc(doc(db, "mesas", mesaId, "pedidosTeste", id));

/** Mestre: últimos pedidos da mesa, do mais novo ao mais antigo. */
export function assinarPedidosDaMesa(mesaId: string, aoLista: (l: PedidoTeste[]) => void): () => void {
  const q = query(col(mesaId), orderBy("criadoEm", "desc"), limit(MAX_PEDIDOS));
  return onSnapshot(q, (s) => aoLista(s.docs.map((d) => ler(d.id, d.data()))), (e) => console.error("pedidosTeste:", e));
}

/** Jogador: só os pedidos pendentes dirigidos a ele, do mais antigo ao mais novo. */
export function assinarMeusPedidos(mesaId: string, meuUid: string, aoLista: (l: PedidoTeste[]) => void): () => void {
  const q = query(col(mesaId), where("paraUid", "==", meuUid), where("status", "==", "pendente"));
  return onSnapshot(
    q,
    (s) => aoLista(s.docs.map((d) => ler(d.id, d.data())).sort((a, b) => a.criadoEm - b.criadoEm)),
    (e) => console.error("pedidosTeste:", e),
  );
}
