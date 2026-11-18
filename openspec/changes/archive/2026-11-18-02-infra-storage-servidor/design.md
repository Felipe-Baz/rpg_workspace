## Context

Hoje `mapas.ts` guarda `imagem` como data URL no documento (limite de 1 MB do Firestore). O acesso por mesa é definido em `firestore.rules` (mestre escreve, jogador lê o que foi liberado).

## Goals / Non-Goals

**Goals:**
- Storage utilizável pelo cliente com regras por mesa.
- Rotas de servidor autenticadas, reutilizáveis pelas próximas changes.
- Compatibilidade total com mapas existentes.

**Non-Goals:**
- Migrar mapas antigos automaticamente.
- Qualquer chamada de IA.

## Decisions

- **Caminhos**: `mesas/{mesaId}/mapas/{arquivo}`, `mesas/{mesaId}/assets/...`, `mesas/{mesaId}/refs/...`.
- **Regras do Storage** usam `firestore.get` para saber se o usuário é dono ou membro da mesa. Liberar leitura por mapa (`todos`/`liberadoPara`) é complexo no Storage, então a leitura é aberta a membros da mesa e a ocultação de mapas não liberados continua na camada Firestore (a URL só chega a quem pode ler o documento).
- **`firebase-admin`** inicializado por credencial em variável de ambiente, apenas em rotas Node (não Edge).
- **`exigirMestre(req, mesaId)`**: helper único que valida token e checa `donoUid`.
- **Upload opcional** em `MapasMestre`: se Storage está configurado, usa URL; senão mantém o fluxo atual.
- Antes de codar, ler os guias do Next em `node_modules/next/dist/docs/` (route handlers), conforme `AGENTS.md`.

## Risks / Trade-offs

- Um membro que obtenha a URL de um mapa não liberado consegue abri-la → usar nomes não adivinháveis e documentar o limite.
- Custo do Blaze → o uso gratuito cobre o volume previsto; configurar alerta de orçamento.
- Credenciais do admin em env → nunca no bundle do cliente.
