"use client";

import { ehDnd5e } from "@/lib/dnd5e";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Flag, Lock, Map as MapIcon, Scroll, Skull, Users } from "lucide-react";
import { confirmar } from "../ui/Dialogos";
import { atualizarMesa, uid, useSegredos } from "@/lib/mesas";
import { usePersistido } from "@/lib/persistido";
import Cronometro from "../sessao/Cronometro";
import Iniciativa from "../sessao/Iniciativa";
import PainelDados from "../sessao/PainelDados";
import PedirTeste from "../sessao/PedirTeste";
import { useMesaAtual } from "../shell/MesaContext";
import Slot from "../shell/Slot";
import Titulo, { campo } from "./Titulo";

const Painel = ({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) => (
  <section className={`min-w-0 rounded-2xl border border-border bg-card p-3 sm:p-4 ${className}`}>
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold">{titulo}</h2>
    {children}
  </section>
);

// Modo "estou jogando agora": dados, iniciativa, cronômetro, notas rápidas e atalhos. Tudo a um clique.
export default function SessaoAoVivo() {
  const mesa = useMesaAtual();
  const router = useRouter();
  const base = `/mesas/${mesa.id}`;
  const [notas, setNotas] = usePersistido<string>(`notas-sessao:${mesa.id}`, "");
  const { segredos, atualizar: atualizarSegredos } = useSegredos(mesa.id, true);

  const atalhos = [
    { href: `${base}/mapas`, rotulo: "Mapas", icone: MapIcon },
    { href: `${base}/mundo`, rotulo: "Mundo", icone: BookOpenText },
    { href: `${base}/missoes`, rotulo: "Missões", icone: Scroll },
    { href: `${base}/fichas/npc`, rotulo: "NPCs", icone: Users },
    { href: `${base}/fichas/inimigo`, rotulo: "Inimigos", icone: Skull },
    { href: `${base}/segredos`, rotulo: "Segredos", icone: Lock },
  ];

  // Cria a sessão no diário da mesa, levando as notas rápidas para as notas secretas dela.
  async function encerrar() {
    const ok = await confirmar({
      titulo: "Encerrar sessão",
      texto: "Vamos registrar uma nova sessão de hoje na mesa e guardar suas notas rápidas como notas secretas dela.",
      confirmar: "Registrar sessão",
    });
    if (!ok) return;
    const id = uid();
    const hoje = new Date();
    const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    atualizarMesa(mesa.id, { sessoes: [...mesa.sessoes, { id, titulo: `Sessão ${mesa.sessoes.length + 1}`, data, resumoPublico: "" }] });
    if (notas.trim()) atualizarSegredos({ ...segredos, notasSessoes: { ...segredos.notasSessoes, [id]: notas } });
    setNotas("");
    router.push(`${base}/sessoes`);
  }

  return (
    <>
      <Titulo
        titulo="Sessão ao vivo"
        texto="Tudo o que você precisa durante o jogo, num só lugar. Iniciativa, cronômetro e notas ficam salvos neste navegador."
        acao={
          <button onClick={encerrar} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent-hover hover:bg-card sm:px-4">
            <Flag size={15} /> Encerrar e registrar
          </button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-4">
          <Painel titulo="Iniciativa e combate">
            <Iniciativa mesaId={mesa.id} opcoes={mesa.opcoesRegras} aoVivo={ehDnd5e(mesa.sistema)} jogadores={mesa.jogadores.map((j) => ({ nome: j.personagem || j.nome, uid: j.uid })).filter((j) => j.nome)} />
          </Painel>
          <Painel titulo="Pedir teste"><PedirTeste /></Painel>
          <Painel titulo="Notas rápidas">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={7} placeholder="O que aconteceu, ideias, nomes improvisados… Vira nota secreta da sessão ao encerrar." className={campo} />
          </Painel>
        </div>
        <div className="min-w-0 space-y-4">
          <Painel titulo="Dados"><PainelDados mesaId={mesa.id} /></Painel>
          <Painel titulo="Duração"><Cronometro /></Painel>
          <Slot nome="sessao.painel" />
          <Painel titulo="Atalhos">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {atalhos.map((a) => (
                <Link key={a.href} href={a.href} className="elevar flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <a.icone size={16} className="text-gold" /> {a.rotulo}
                </Link>
              ))}
            </div>
          </Painel>
        </div>
      </div>
    </>
  );
}
