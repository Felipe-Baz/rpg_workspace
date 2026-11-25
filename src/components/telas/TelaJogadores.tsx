"use client";

import { useEffect, useState } from "react";
import LivroNotas from "../LivroNotas";
import { confirmar } from "../ui/Dialogos";
import { toast } from "../ui/Toasts";
import { agirSobreMembro, listarPessoas, type AcaoMembro, type PessoaMesa } from "@/lib/membros-cliente";
import AvatarPersonagem from "../AvatarPersonagem";
import { atualizarMesa, paginasDe, uid, useSegredos } from "@/lib/mesas";
import { useMesaAtual } from "../shell/MesaContext";
import Titulo, { campo } from "./Titulo";

export default function TelaJogadores() {
  const mesa = useMesaAtual();
  const { segredos, atualizar: atualizarSegredos } = useSegredos(mesa.id, true);
  const set = (jogadores: typeof mesa.jogadores) => atualizarMesa(mesa.id, { jogadores });

  return (
    <>
      <Titulo termo="jogadores" titulo="Jogadores" texto="Quem joga na mesa e as suas notas secretas sobre cada um." />
      <section className="space-y-5">
        {mesa.jogadores.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
            Nenhum jogador ainda. Compartilhe o código de convite ou adicione manualmente.
          </p>
        )}
        {mesa.jogadores.map((j) => (
          <div key={j.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-2">
              <AvatarPersonagem mesaId={mesa.id} jogadorId={j.id} foto={j.foto} nome={j.personagem || j.nome} editavel />
              <input
                value={j.nome}
                onChange={(e) => set(mesa.jogadores.map((x) => (x.id === j.id ? { ...x, nome: e.target.value } : x)))}
                placeholder="Jogador"
                className={campo}
              />
              <input
                value={j.personagem}
                onChange={(e) => set(mesa.jogadores.map((x) => (x.id === j.id ? { ...x, personagem: e.target.value } : x)))}
                placeholder="Personagem"
                className={campo}
              />
              <button
                onClick={() => {
                  set(mesa.jogadores.filter((x) => x.id !== j.id));
                  const resto = { ...segredos.notasJogadores };
                  delete resto[j.id];
                  atualizarSegredos({ ...segredos, notasJogadores: resto });
                }}
                aria-label="Remover jogador"
                className="px-2 text-muted hover:text-danger"
              >
                ✕
              </button>
            </div>
            <LivroNotas
              paginas={paginasDe(segredos.notasJogadores?.[j.id])}
              onChange={(p) => atualizarSegredos({ ...segredos, notasJogadores: { ...segredos.notasJogadores, [j.id]: p } })}
              placeholder="🔒 Notas secretas sobre este jogador (só o mestre vê)"
            />
          </div>
        ))}
        <button
          onClick={() => set([...mesa.jogadores, { id: uid(), nome: "", personagem: "" }])}
          className="text-sm text-accent-hover hover:underline"
        >
          + Adicionar jogador
        </button>
      </section>
      <ContasDaMesa mesaId={mesa.id} nMembros={mesa.membros.length} />
    </>
  );
}

/** Gestão das contas que entraram por código: remover, apagar ficha, bloquear/desbloquear. */
function ContasDaMesa({ mesaId, nMembros }: { mesaId: string; nMembros: number }) {
  const [dados, setDados] = useState<{ membros: PessoaMesa[]; bloqueados: PessoaMesa[] } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Recarrega quando alguém entra ou sai (muda a quantidade de membros).
  useEffect(() => {
    let vivo = true;
    listarPessoas(mesaId)
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && toast(e instanceof Error ? e.message : "Não foi possível listar as contas.", "erro"));
    return () => {
      vivo = false;
    };
  }, [mesaId, nMembros]);

  async function agir(acao: AcaoMembro, p: PessoaMesa, texto: string, ok: string, rotulo: string) {
    if (!(await confirmar({ titulo: `${rotulo}: ${p.nome}`, texto, confirmar: rotulo, perigo: acao !== "desbloquear" }))) return;
    setOcupado(true);
    try {
      await agirSobreMembro(mesaId, acao, p.uid, p.nome);
      toast(ok);
      setDados(await listarPessoas(mesaId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível concluir.", "erro");
    } finally {
      setOcupado(false);
    }
  }

  const btn = "rounded-lg border border-border px-3 py-1 text-xs hover:border-accent-hover disabled:opacity-50";
  return (
    <section className="mt-10 space-y-3">
      <h2 className="font-semibold">Contas na mesa</h2>
      <p className="text-sm text-muted">
        Remover apaga tudo o que é só da pessoa (diário, pinos, ficha, rolagens…) e não mexe no conteúdo da mesa. Bloquear remove e impede de voltar pelo código.
      </p>
      {dados === null ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : dados.membros.length === 0 ? (
        <p className="text-sm text-muted">Ninguém além de você entrou na mesa ainda.</p>
      ) : (
        dados.membros.map((p) => (
          <div key={p.uid} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
            <span className="mr-auto font-medium">{p.nome}</span>
            <button disabled={ocupado} className={btn} onClick={() => agir("apagarFicha", p, "Apaga somente a ficha de D&D 5e desta pessoa. Isso não pode ser desfeito.", "Ficha apagada", "Apagar ficha")}>
              Apagar ficha
            </button>
            <button disabled={ocupado} className={btn} onClick={() => agir("remover", p, "Tira a pessoa da mesa e apaga os dados dela (personagem, diário, ficha, pinos, rolagens). Ela ainda poderá voltar com o código.", "Jogador removido", "Remover")}>
              Remover
            </button>
            <button disabled={ocupado} className={`${btn} text-danger`} onClick={() => agir("bloquear", p, "Remove a pessoa, apaga os dados dela e impede que entre de novo pelo código.", "Conta bloqueada", "Bloquear")}>
              Bloquear
            </button>
          </div>
        ))
      )}
      {!!dados?.bloqueados.length && (
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-semibold text-muted">Bloqueadas</h3>
          {dados.bloqueados.map((p) => (
            <div key={p.uid} className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3">
              <span className="mr-auto">{p.nome}</span>
              <button disabled={ocupado} className={btn} onClick={() => agir("desbloquear", p, "A pessoa poderá entrar de novo com o código de convite.", "Conta desbloqueada", "Desbloquear")}>
                Desbloquear
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
