"use client";

import MapasMestre from "../mapas/MapasMestre";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo from "./Titulo";

export default function TelaImagens() {
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="imagens" titulo="Imagens" texto="Ilustrações e handouts para mostrar aos jogadores." />
      <MapasMestre mesa={mesa} colecao="imagens" />
    </>
  );
}
