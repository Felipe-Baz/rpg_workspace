"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { CATEGORIAS } from "@/lib/fichas";
import { useAnotacoes } from "@/lib/mesas";
import FichasJogador from "../fichas/FichasJogador";
import MapasJogador from "../mapas/MapasJogador";
import Missoes from "../Missoes";
import Mundo from "../Mundo";
import QuadroJogador from "../quadro/QuadroJogador";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo from "./Titulo";

// Telas de leitura do jogador: o mestre é quem libera o conteúdo.
export function MapasJ() {
  const { user } = useAuth();
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo titulo="Mapas" texto="Os mapas que o mestre liberou para você. Marque pinos e escreva notas privadas." />
      {user && <MapasJogador mesaId={mesa.id} usuarioUid={user.uid} />}
    </>
  );
}

export function ImagensJ() {
  const { user } = useAuth();
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo titulo="Imagens" texto="Ilustrações e handouts liberados pelo mestre." />
      {user && <MapasJogador mesaId={mesa.id} usuarioUid={user.uid} colecao="imagens" />}
    </>
  );
}

export function MundoJ() {
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo titulo="Mundo" texto="O que o seu personagem conhece do mundo." />
      <Mundo mesaId={mesa.id} ehMestre={false} />
    </>
  );
}

export function MissoesJ() {
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo titulo="Missões" texto="O diário de missões do grupo." />
      <Missoes mesaId={mesa.id} ehMestre={false} />
    </>
  );
}

export function QuadroJ() {
  const { user } = useAuth();
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo titulo="Quadro" texto="Seu quadro de investigação, só seu." />
      {user && <QuadroJogador mesaId={mesa.id} usuarioUid={user.uid} />}
    </>
  );
}

export function FichasJ() {
  const { user } = useAuth();
  const mesa = useMesaAtual();
  const { categoria } = useParams<{ categoria: string }>();
  const c = CATEGORIAS.find((x) => x.id === categoria);
  const { opinioes, carregado, definirOpiniao } = useAnotacoes(mesa.id, user?.uid ?? "", !!user);

  if (!c || !user)
    return (
      <p className="text-muted">
        Categoria não encontrada. <Link href={`/mesas/${mesa.id}/jogador`} className="underline">Voltar</Link>
      </p>
    );

  return (
    <FichasJogador
      key={c.id}
      mesaId={mesa.id}
      usuarioUid={user.uid}
      categoria={c.id}
      rotulo={c.rotulo}
      singular={c.singular}
      icone={c.icone}
      opinioes={{ valores: opinioes, carregado, definir: definirOpiniao }}
    />
  );
}
