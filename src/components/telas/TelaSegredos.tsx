"use client";

import { useSegredos } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo, { campo } from "./Titulo";

export default function TelaSegredos() {
  const mesa = useMesaAtual();
  const { segredos, atualizar } = useSegredos(mesa.id, true);
  return (
    <>
      <Titulo titulo="Segredos da campanha" texto="Tramas, vilões e reviravoltas. Só você vê esta página." />
      <textarea
        value={segredos.segredosMestre}
        onChange={(e) => atualizar({ ...segredos, segredosMestre: e.target.value })}
        rows={14}
        placeholder="Tramas, vilões, reviravoltas… só você vê isto."
        className={`${campo} border-warn/50`}
      />
    </>
  );
}
