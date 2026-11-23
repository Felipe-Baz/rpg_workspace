"use client";

import Mundo from "../Mundo";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo from "./Titulo";

export default function TelaMundo() {
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="mundo" titulo="Mundo" texto="Artigos e lore da campanha." />
      <Mundo mesaId={mesa.id} ehMestre />
    </>
  );
}
