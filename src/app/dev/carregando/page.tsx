export const instant = false;

export default async function Page() {
  await new Promise((r) => setTimeout(r, 6000));
  return (
    <main id="conteudo" className="mx-auto max-w-xl px-4 py-12 text-center">
      <p className="text-foreground">Carregou. Recarregue ou volte e entre de novo para ver o loading outra vez.</p>
    </main>
  );
}
