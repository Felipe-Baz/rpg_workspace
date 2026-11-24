"use client";

import { useState } from "react";
import { LIVROS } from "@/lib/livros";
import Abas from "../Abas";
import LeitorLivro from "../livros/LeitorLivro";
import Titulo from "./Titulo";

/** Biblioteca de regras do mestre: uma aba por livro (por ora, só o Livro do Jogador de D&D 5e). */
export default function TelaLivros() {
  const [livroId, setLivroId] = useState(LIVROS[0].id);
  const livro = LIVROS.find((l) => l.id === livroId) ?? LIVROS[0];
  return (
    <div className="space-y-5">
      <Titulo titulo="Livros" texto="As regras de D&D para consultar na mesa, organizadas por livro." />
      <Abas abas={LIVROS.map((l) => ({ id: l.id, rotulo: l.titulo }))} ativa={livro.id} onChange={setLivroId} />
      <LeitorLivro key={livro.id} livro={livro} />
    </div>
  );
}
