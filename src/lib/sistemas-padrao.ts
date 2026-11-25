// Sistemas públicos oferecidos a todos. A fonte é a coleção `sistemas` do Firestore (carregada por
// `scripts/semear-sistemas.mjs`); esta lista é o padrão usado enquanto a coleção está vazia ou ilegível.
export const SISTEMAS_PADRAO = ["D&D 5e", "Tormenta20", "Pathfinder 2e", "Call of Cthulhu", "Vampiro: A Máscara"];

export type OpcaoSistema = { nome: string; proprio: boolean; id?: string };

/** Junta públicos e pessoais: sem repetir nome (ignorando caixa), públicos primeiro, cada grupo em ordem alfabética. */
export function montarOpcoes(publicos: string[], pessoais: { id: string; nome: string }[]): OpcaoSistema[] {
  const vistos = new Set<string>();
  const chave = (n: string) => n.trim().toLocaleLowerCase("pt-BR");
  const pub: OpcaoSistema[] = [];
  for (const nome of publicos) {
    if (!nome.trim() || vistos.has(chave(nome))) continue;
    vistos.add(chave(nome));
    pub.push({ nome: nome.trim(), proprio: false });
  }
  const priv: OpcaoSistema[] = [];
  for (const p of pessoais) {
    if (!p.nome.trim() || vistos.has(chave(p.nome))) continue;
    vistos.add(chave(p.nome));
    priv.push({ nome: p.nome.trim(), proprio: true, id: p.id });
  }
  const ordem = (a: OpcaoSistema, b: OpcaoSistema) => a.nome.localeCompare(b.nome, "pt-BR");
  return [...pub.sort(ordem), ...priv.sort(ordem)];
}
