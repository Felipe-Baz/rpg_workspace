import ConfigIa, { CabecalhoIa } from "@/components/ia/ConfigIa";

export const instant = false;

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <CabecalhoIa />
      <ConfigIa />
    </main>
  );
}
