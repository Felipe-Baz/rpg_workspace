"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import FichasJogador from "../fichas/FichasJogador";
import { useUidJogador } from "../shell/VisaoJogadorContext";
import { CATEGORIAS } from "@/lib/fichas";
import { useExtensoesContexto } from "../shell/ExtensoesContext";
import { useMesaAtual } from "../shell/MesaContext";

export default function TelaFichas() {
  const { uid } = useUidJogador();
  const mesa = useMesaAtual();
  const { efeitos } = useExtensoesContexto();
  const { categoria } = useParams<{ categoria: string }>();
  const c = CATEGORIAS.find((x) => x.id === categoria);

  if (!c || !uid)
    return (
      <p className="text-muted">
        Categoria não encontrada. <Link href={`/mesas/${mesa.id}`} className="underline">Voltar</Link>
      </p>
    );

  return (
    <FichasJogador
      key={c.id}
      mesa={mesa}
      mesaId={mesa.id}
      usuarioUid={uid}
      categoria={c.id}
      rotulo={efeitos.termos[`fichas.${c.id}` as never] ?? c.rotulo}
      singular={c.singular}
      icone={c.icone}
    />
  );
}
