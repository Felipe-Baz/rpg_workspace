"use client";

// Última rede de segurança: substitui o layout raiz, então define html/body e estilos próprios.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15131a",
          color: "#f1eef7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 16,
        }}
      >
        <title>Erro · RPG Workspace</title>
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 56, fontWeight: 700, color: "#c9a45c", margin: 0 }}>Ops</p>
          <h1 style={{ fontSize: 24, margin: "12px 0 8px" }}>A plataforma encontrou um erro grave</h1>
          <p style={{ color: "#a39db3", fontSize: 14 }}>Não foi possível exibir a página. Tente recarregar.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 20, background: "#7c3aed", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 14 }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
