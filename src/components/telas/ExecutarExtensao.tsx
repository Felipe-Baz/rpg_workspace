"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { definirAtiva, definirVisibilidade, removerDaMesa, useExtensoesMesa } from "@/lib/extensoes/dados";
import PainelExtensao from "../extensoes/PainelExtensao";
import { useMesaAtual } from "../shell/MesaContext";
import { confirmar } from "../ui/Dialogos";
import { ListaSkeleton } from "../ui/Skeleton";
import { PERMISSOES } from "@/lib/extensoes/capacidades";
import HistoricoExtensao from "../extensoes/HistoricoExtensao";
import Titulo from "./Titulo";

// Roda uma extensão instalada na mesa. Mestre: salva estado, edita, publica. Jogador: só usa (somente leitura).
export default function ExecutarExtensao({ modo }: { modo: "mestre" | "jogador" }) {
  const mesa = useMesaAtual();
  const router = useRouter();
  const { extId } = useParams<{ extId: string }>();
  const mestre = modo === "mestre";
  const { extensoes, carregado } = useExtensoesMesa(mesa.id, mestre);
  const ext = extensoes.find((e) => e.id === extId);
  const base = mestre ? `/mesas/${mesa.id}` : `/mesas/${mesa.id}/jogador`;
  if (!carregado) return <ListaSkeleton linhas={2} />;
  if (!ext)
    return (
      <p className="text-muted">
        Extensão não encontrada{mestre ? "" : " ou não liberada pelo mestre"}. <Link href={mestre ? `${base}/extensoes` : base} className="underline">Voltar</Link>
      </p>
    );

  async function remover() {
    if (!(await confirmar({ perigo: true, titulo: "Remover da mesa", texto: `"${ext!.titulo}" sai desta mesa e o estado salvo dela é apagado. Ela continua na sua biblioteca.`, confirmar: "Remover" }))) return;
    await removerDaMesa(mesa.id, ext!.id);
    router.push(`${base}/extensoes`);
  }

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[28rem] flex-col">
      <Titulo
        titulo={ext.titulo}
        texto={[mestre ? (ext.visivelJogadores ? "Visível para os jogadores." : "Só você vê esta extensão.") : "Extensão criada pelo mestre.", (ext.permissoesAprovadas ?? []).length ? `Permissões: ${(ext.permissoesAprovadas ?? []).map((p) => `${PERMISSOES[p].acao === "ler" ? "ler" : "criar"} ${PERMISSOES[p].rotulo.toLowerCase()}`).join(", ")}.` : ""].filter(Boolean).join(" ")}
        acao={
          mestre && (
            <div className="flex flex-wrap gap-2 text-sm">
              <button onClick={() => definirVisibilidade(mesa.id, ext.id, !ext.visivelJogadores)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:border-accent-hover">
                {ext.visivelJogadores ? <EyeOff size={15} /> : <Eye size={15} />} {ext.visivelJogadores ? "Ocultar dos jogadores" : "Liberar para jogadores"}
              </button>
              <Link href={`${base}/extensoes/${ext.id}/editar`} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:border-accent-hover"><Pencil size={15} /> Editar com IA</Link>
              <button onClick={remover} aria-label="Remover da mesa" className="rounded-lg border border-border px-3 py-2 text-muted hover:text-danger"><Trash2 size={15} /></button>
            </div>
          )
        }
      />
      {ext.ativa === false && (
        <p className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">Extensão desativada: ela não aparece no menu, nos encaixes nem muda a mesa.{mestre && <button onClick={() => definirAtiva(mesa.id, ext.id, true)} className="rounded border border-warn/60 px-2 py-0.5 hover:bg-warn/20">Ativar</button>}</p>
      )}
      <div className="min-h-0 flex-1">
        <PainelExtensao ext={ext} mesaId={mesa.id} mestre={mestre} />
      </div>
      {mestre && <HistoricoExtensao mesaId={mesa.id} extId={ext.id} />}
    </div>
  );
}
