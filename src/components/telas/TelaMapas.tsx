"use client";

import MapasMestre from "../mapas/MapasMestre";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo from "./Titulo";

export default function TelaMapas() {
  const mesa = useMesaAtual();
  return (
    <>
      <Titulo termo="mapas" titulo="Mapas" texto="Cenas, mapas de imagem e criação com IA." />
      <MapasMestre mesa={mesa} />
    </>
  );
}
