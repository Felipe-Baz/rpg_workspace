"use client";

import { useEffect, useRef, useState } from "react";
import { salvarResolvida, salvarResposta, useMeusVereditos, useMinhasLiberadas, useMinhasRespostas } from "@/lib/marcas";
import type { EtapaLiberada, Veredito } from "@/lib/marcas-data";
import Cena from "./enigmas/Cena";
import Mecanica from "./enigmas/Mecanica";

// Só aparece quando o Mestre liberou ao menos uma etapa — nada revela que existem enigmas.
export default function Enigmas({ mesaId, uid }: { mesaId: string; uid: string }) {
  const lib = useMinhasLiberadas(mesaId, uid);
  const resp = useMinhasRespostas(mesaId, uid);
  const ver = useMeusVereditos(mesaId, uid);
  if (!lib.pronto || !resp.pronto || !ver.pronto || lib.v.length === 0) return null;

  return (
    <section>
      <Cena ambiente={lib.v.find((e) => e.ambiente)?.ambiente}>
        {lib.v.map((e) => (
          <Etapa
            key={e.idx}
            mesaId={mesaId}
            uid={uid}
            etapa={e}
            inicial={resp.v[String(e.idx)] ?? ""}
            decifrada={resp.v[`ok${e.idx}`] !== undefined}
            veredito={ver.v[String(e.idx)]}
          />
        ))}
      </Cena>
    </section>
  );
}

function Etapa({
  mesaId, uid, etapa, inicial, decifrada, veredito,
}: { mesaId: string; uid: string; etapa: EtapaLiberada; inicial: string; decifrada: boolean; veredito?: Veredito }) {
  const [texto, setTexto] = useState(inicial);
  const [status, setStatus] = useState<"ocioso" | "salvando" | "salvo" | "erro">("ocioso");
  const [feito, setFeito] = useState(false);
  const sujo = useRef(false);
  const aprovada = veredito?.estado === "aprovada";
  const mec = etapa.mecanica;
  // Etapas antigas (sem mecânica) ou já aprovadas pelo Mestre vão direto à pergunta.
  const aberta = !mec || decifrada || feito || aprovada;

  useEffect(() => {
    if (!sujo.current) return;
    const t = setTimeout(() => {
      salvarResposta(mesaId, uid, etapa.idx, texto).then(() => setStatus("salvo"), () => setStatus("erro"));
    }, 700);
    return () => clearTimeout(t);
  }, [texto, mesaId, uid, etapa.idx]);

  const concluir = (valor: string) => {
    setFeito(true);
    salvarResolvida(mesaId, uid, etapa.idx, valor).catch(() => {});
  };

  return (
    <article className={`panel etapa p-5 ${aberta && mec ? "etapa-aberta" : ""}`} style={aprovada ? { borderColor: "var(--m-gold)" } : undefined}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="display gold glitch-titulo text-lg" data-texto={etapa.titulo}>{etapa.titulo}</h3>
        {aprovada ? <span className="tag">Resolvido</span> : mec && aberta ? <span className="tag">Decifrado</span> : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap italic">{etapa.texto}</p>

      {mec && !aberta && (
        <div className="mt-4">
          <Mecanica m={mec} onConcluir={concluir} />
        </div>
      )}

      {mec && aberta && etapa.revelacao && <p className="revelacao mt-4">{etapa.revelacao}</p>}

      {aberta && (
        <>
          <p className="mt-4 font-semibold">{etapa.pergunta}</p>
          <textarea
            className="mt-2"
            aria-label={`Resposta: ${etapa.titulo}`}
            value={texto}
            readOnly={aprovada}
            onChange={(e) => {
              sujo.current = true;
              setStatus("salvando");
              setTexto(e.target.value);
            }}
          />
          <p className="mt-1 text-sm dim" aria-live="polite">
            {status === "salvando" && "Gravando…"}
            {status === "salvo" && "Gravado ✓"}
            {status === "erro" && "Não foi possível gravar."}
          </p>
        </>
      )}
      {veredito?.estado === "recusada" && (
        <p className="mt-2" style={{ color: "var(--m-blood-hi)" }}>
          O Mestre não aceitou essa resposta{veredito.nota ? `: ${veredito.nota}` : "."} Reflita e tente de novo.
        </p>
      )}
    </article>
  );
}
