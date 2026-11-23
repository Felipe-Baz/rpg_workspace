"use client";

import MarcasApp from "../marcas/MarcasApp";
import { useMesaAtual } from "../shell/MesaContext";

export default function TelaMarcas() {
  const mesa = useMesaAtual();
  return <MarcasApp mesaId={mesa.id} />;
}
