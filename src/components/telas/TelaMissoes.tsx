"use client";

import Missoes from "../Missoes";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo from "./Titulo";

export default function TelaMissoes() {
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="missoes" titulo="Missões" texto="O diário de missões da campanha." />
      <Missoes mesaId={mesa.id} ehMestre />
    </>
  );
}
