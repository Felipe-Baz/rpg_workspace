"use client";

import { useState } from "react";
import { useUidJogador } from "../shell/VisaoJogadorContext";
import { ehDnd5e } from "@/lib/dnd5e";
import FichaDnd5e from "../dnd/FichaDnd5e";
import ResumoDoGrupo from "../dnd/ResumoDoGrupo";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo from "./Titulo";

const Aviso = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">{children}</p>
);

/** Ficha do próprio jogador (ou do mestre, quando ele joga). */
export function FichaDndJogador() {
  const { uid } = useUidJogador();
  const mesa = useMesaAtual();
  const meu = mesa.jogadores.find((j) => j.uid === uid);
  return (
    <>
      <Titulo titulo="Minha ficha" texto="Ficha de D&D 5e. Tudo é salvo automaticamente e só você e o mestre veem." />
      {!ehDnd5e(mesa.sistema) ? (
        <Aviso>Esta mesa não usa D&D 5e, então a ficha automatizada não está disponível.</Aviso>
      ) : uid ? (
        <FichaDnd5e mesaId={mesa.id} donoUid={uid} nomePadrao={meu?.personagem} opcoes={mesa.opcoesRegras} />
      ) : null}
    </>
  );
}

/** O mestre abre e edita a ficha de qualquer jogador que já assumiu um personagem. */
export function FichasDndMestre() {
  const mesa = useMesaAtual();
  const jogadores = mesa.jogadores.filter((j) => j.uid);
  const [sel, setSel] = useState<string>("");
  const atual = jogadores.find((j) => j.uid === sel) ?? jogadores[0];
  return (
    <>
      <Titulo titulo="Fichas dos personagens" texto="Fichas de D&D 5e dos seus jogadores. Você pode ler e editar." />
      {!ehDnd5e(mesa.sistema) ? (
        <Aviso>Esta mesa não usa D&D 5e. Troque o sistema em Configurações para usar a ficha automatizada.</Aviso>
      ) : !atual ? (
        <Aviso>Nenhum jogador assumiu um personagem ainda.</Aviso>
      ) : (
        <>
          <ResumoDoGrupo mesaId={mesa.id} jogadores={jogadores.map((j) => ({ uid: j.uid!, nome: j.personagem || j.nome || "Sem nome" }))} opcoes={mesa.opcoesRegras} aoAbrir={(uid) => { setSel(uid); window.scrollTo({ top: 99999, behavior: "smooth" }); }} />
          <div className="mb-4 flex flex-wrap gap-2">
            {jogadores.map((j) => (
              <button
                key={j.id}
                onClick={() => setSel(j.uid!)}
                aria-pressed={j.uid === atual.uid}
                className={`rounded-full border px-4 py-1.5 text-sm ${j.uid === atual.uid ? "border-gold bg-gold/15 text-gold" : "border-border text-muted hover:text-foreground"}`}
              >
                {j.personagem || j.nome || "Sem nome"}
              </button>
            ))}
          </div>
          <FichaDnd5e key={atual.uid} mesaId={mesa.id} donoUid={atual.uid!} nomePadrao={atual.personagem} papel="mestre" opcoes={mesa.opcoesRegras} />
        </>
      )}
    </>
  );
}
