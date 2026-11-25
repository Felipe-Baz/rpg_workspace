import Image from "next/image";

// Logos do site (arquivos recortados em /public). "icone" = só o brasão; "completa" = brasão + nome.
export function LogoIcone({ altura = 28, className = "" }: { altura?: number; className?: string }) {
  return <Image src="/logo-icone.png" alt="" width={Math.round((altura * 182) / 223)} height={altura} style={{ width: "auto", height: altura }} className={`shrink-0 ${className}`} priority />;
}

export function LogoCompleta({ altura = 160, className = "" }: { altura?: number; className?: string }) {
  return <Image src="/logo-completa.png" alt="RPG Workspace" width={Math.round((altura * 291) / 299)} height={altura} style={{ width: "auto", height: altura }} className={`shrink-0 ${className}`} priority />;
}

// Marca para cabeçalhos: brasão + nome.
export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoIcone altura={30} /> RPG Workspace
    </span>
  );
}
