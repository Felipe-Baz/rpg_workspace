"use client";

import LivroNotas from "../LivroNotas";
import AvatarPersonagem from "../AvatarPersonagem";
import { atualizarMesa, paginasDe, uid, useSegredos } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo, { campo } from "./Titulo";

export default function TelaJogadores() {
  const mesa = useMesaAtual();
  const { segredos, atualizar: atualizarSegredos } = useSegredos(mesa.id, true);
  const set = (jogadores: typeof mesa.jogadores) => atualizarMesa(mesa.id, { jogadores });

  return (
    <>
      <Titulo titulo="Jogadores" texto="Quem joga na mesa e as suas notas secretas sobre cada um." />
      <section className="space-y-5">
        {mesa.jogadores.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
            Nenhum jogador ainda. Compartilhe o código de convite ou adicione manualmente.
          </p>
        )}
        {mesa.jogadores.map((j) => (
          <div key={j.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-2">
              <AvatarPersonagem mesaId={mesa.id} jogadorId={j.id} foto={j.foto} nome={j.personagem || j.nome} editavel />
              <input
                value={j.nome}
                onChange={(e) => set(mesa.jogadores.map((x) => (x.id === j.id ? { ...x, nome: e.target.value } : x)))}
                placeholder="Jogador"
                className={campo}
              />
              <input
                value={j.personagem}
                onChange={(e) => set(mesa.jogadores.map((x) => (x.id === j.id ? { ...x, personagem: e.target.value } : x)))}
                placeholder="Personagem"
                className={campo}
              />
              <button
                onClick={() => {
                  set(mesa.jogadores.filter((x) => x.id !== j.id));
                  const resto = { ...segredos.notasJogadores };
                  delete resto[j.id];
                  atualizarSegredos({ ...segredos, notasJogadores: resto });
                }}
                aria-label="Remover jogador"
                className="px-2 text-muted hover:text-danger"
              >
                ✕
              </button>
            </div>
            <LivroNotas
              paginas={paginasDe(segredos.notasJogadores?.[j.id])}
              onChange={(p) => atualizarSegredos({ ...segredos, notasJogadores: { ...segredos.notasJogadores, [j.id]: p } })}
              placeholder="🔒 Notas secretas sobre este jogador (só o mestre vê)"
            />
          </div>
        ))}
        <button
          onClick={() => set([...mesa.jogadores, { id: uid(), nome: "", personagem: "" }])}
          className="text-sm text-accent-hover hover:underline"
        >
          + Adicionar jogador
        </button>
      </section>
    </>
  );
}
