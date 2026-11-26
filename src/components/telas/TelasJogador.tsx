"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CATEGORIAS } from "@/lib/fichas";
import { useAnotacoes } from "@/lib/mesas";
import FichasJogador from "../fichas/FichasJogador";
import MapasJogador from "../mapas/MapasJogador";
import Missoes from "../Missoes";
import Mundo from "../Mundo";
import QuadroJogador from "../quadro/QuadroJogador";
import { useExtensoesContexto } from "../shell/ExtensoesContext";
import { useMesaAtual } from "../shell/MesaContext";
import { useUidJogador } from "../shell/VisaoJogadorContext";
import Titulo from "./Titulo";

// Telas de leitura do jogador: o mestre é quem libera o conteúdo.
export function MapasJ() {
  const { uid } = useUidJogador();
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="mapas" titulo="Mapas" texto="Os mapas que o mestre liberou para você. Marque pinos e escreva notas privadas." />
      {uid && <MapasJogador mesaId={mesa.id} usuarioUid={uid} />}
    </>
  );
}

export function ImagensJ() {
  const { uid } = useUidJogador();
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="imagens" titulo="Imagens" texto="Ilustrações e handouts liberados pelo mestre." />
      {uid && <MapasJogador mesaId={mesa.id} usuarioUid={uid} colecao="imagens" />}
    </>
  );
}

export function MundoJ() {
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="mundo" titulo="Mundo" texto="O que o seu personagem conhece do mundo." />
      <Mundo mesaId={mesa.id} ehMestre={false} />
    </>
  );
}

export function MissoesJ() {
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="missoes" titulo="Missões" texto="O diário de missões do grupo." />
      <Missoes mesaId={mesa.id} ehMestre={false} />
    </>
  );
}

export function QuadroJ() {
  const { uid } = useUidJogador();
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="quadro" titulo="Quadro" texto="Seu quadro de investigação, só seu." />
      {uid && <QuadroJogador mesaId={mesa.id} usuarioUid={uid} />}
    </>
  );
}

export function FichasJ() {
  const { uid, vendoComo } = useUidJogador();
  const mesa = useMesaAtual();
  const { categoria } = useParams<{ categoria: string }>();
  const { efeitos } = useExtensoesContexto();
  const c = CATEGORIAS.find((x) => x.id === categoria);
  const { opinioes, carregado, definirOpiniao } = useAnotacoes(mesa.id, uid, !!uid, vendoComo);

  if (!c || !uid)
    return (
      <p className="text-muted">
        Categoria não encontrada. <Link href={`/mesas/${mesa.id}/jogador`} className="underline">Voltar</Link>
      </p>
    );

  return (
    <FichasJogador
      key={c.id}
      mesaId={mesa.id}
      usuarioUid={uid}
      categoria={c.id}
      rotulo={efeitos.termos[`fichas.${c.id}` as never] ?? c.rotulo}
      singular={c.singular}
      icone={c.icone}
      apenasLeitura={vendoComo}
      opinioes={{ valores: opinioes, carregado, definir: definirOpiniao }}
    />
  );
}
