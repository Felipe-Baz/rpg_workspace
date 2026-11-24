import OfflineAviso from "@/components/ui/OfflineAviso";

export const instant = false;

export default function Page() {
  return (
    <main id="conteudo" className="mx-auto max-w-xl px-4 py-12 text-center">
      <p className="text-sm text-muted">O aviso de sem conexão está forçado nesta página.</p>
      <OfflineAviso forcar />
    </main>
  );
}
