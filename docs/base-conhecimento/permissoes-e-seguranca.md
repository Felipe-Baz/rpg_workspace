# Permissões e segurança

A barreira real é **Firestore Rules + Storage Rules + rotas de servidor**. A interface só reflete essas regras. Fonte: `firestore.rules`, `storage.rules`, `src/lib/servidor/auth.ts`.

## Matriz resumida (dentro de `mesas/{id}`)

| Dado | Mestre | Jogador (membro) | Por quê |
|---|---|---|---|
| Documento da mesa | lê/escreve (não pode trocar `donoUid`) | lê; só pode **entrar** (+1 em `membros`), **sair**, e **assumir/criar o próprio personagem** em `jogadores` | Convite por código sem dar poder de edição |
| Mapas e Imagens | lê/escreve tudo | lê só os liberados (`todos` ou em `liberadoPara`) | Controlar spoiler |
| Cenas, temas, assets, segredos | só ele | nada | Preparação e notas do mestre |
| Mundo | escreve | lê | Lore público da campanha |
| Missões (pública) | escreve | lê | Versão derivada, sem segredos |
| Missões do mestre | só ele | nada | Etapas pendentes e notas nunca vazam |
| Fichas do jogador (`mestre:false`) | **não** lê | dono lê/escreve; não liberável | Privacidade do jogador |
| Fichas do mestre (`mestre:true`) | lê/escreve | lê só se `todos` ou `liberadoPara` contém o uid | Liberação seletiva |
| Diário (`anotacoes/{uid}`), pinos, quadro | nada | só o próprio dono | Material privado do jogador |
| Extensões instaladas | gerencia | lê só as `visivelJogadores` | Mestre decide o que aparece |
| Extensões nativas: `extensoesNativas/{id}` | grava | lê (para saber o que mostrar) | Mestre pode ocultar as Marcas de Pacto dos jogadores; sem registro = visível |
| `uso`, `usoRegistros`, `jobs` | lê | nada | Só o servidor escreve (Admin SDK) |
| Marcas: `lore`, `puzzles` | só ele | nada | Gabarito nunca vai ao cliente de jogador |
| Marcas: `assignments`, `released`, `puzzleStatus` | escreve | lê o próprio | Mestre controla a progressão |
| Marcas: `notes`, `puzzleResp` | lê | escreve o próprio (precisa ter Marca atribuída) | Jogador responde, mestre avalia |

Fora de `mesas`:
- `convites/{codigo}`: `get` por código exato para qualquer logado, **sem `list`**. Quem não tem o código não enumera mesas.
- `extensoes/{id}` (biblioteca): só o `donoUid`.
- `assetsPublicos`: qualquer logado lê; ninguém no cliente escreve.
- `usuarios/{uid}/**`: **bloqueado** ao cliente (configuração de IA e chaves cifradas).

## Storage

- `mesas/{id}/**`: **membros leem**, só o mestre escreve (imagens até 15 MB; JSON permitido em `cenas/`).
- `publico/**`: logado lê, só servidor escreve.
- **Limite conhecido:** a ocultação de mapas não liberados é no Firestore. Quem obtiver a URL de um arquivo no Storage consegue abri-lo; os nomes são aleatórios. Aceito por enquanto.

## Rotas de servidor

1. `verificarToken`: valida o ID token do Firebase (`401` se ausente/inválido).
2. `exigirMestre(mesaId)`: confere `uid === donoUid` no Firestore (`403` caso contrário).
3. A chave de IA usada é **sempre a do mestre dono da mesa**, nunca a de quem chama.
4. Erros de provedor voltam **saneados** (sem chave). `GET /api/saude` só informa "configurado ou não".
5. Entradas de mapa para IA são lidas **do documento da mesa**, nunca de URL vinda do corpo da requisição (evita SSRF/vazamento entre mesas).

## Extensões (isolamento)

- Iframe com `sandbox`, **CSP sem rede**, comunicação só por `postMessage`; sem acesso a cookies, storage, Firebase ou DOM do app.
- Limites: HTML ≤ 150 KB, estado salvo ≤ 50 KB, título ≤ 80 caracteres.
- **Leitura de dados da mesa pelo broker:** a extensão só lê o que o **mestre aprovou** (`permissoesAprovadas`) e, mesmo assim, apenas o que a **conta de quem usa** já pode ler (jogador não recebe dados de mestre). Pedidos são validados, limitados (20/s, 200 mil caracteres) e atendidos só ao próprio iframe. Esta fase **não grava** dados da mesa. Os dados privados que a extensão guardar em `RPG.salvar` ficam visíveis a quem a usa, e o consentimento avisa disso.
- Extensões **nativas** são bloqueadas **na interface** por mesa e, para o jogador, pela opção de ocultar do mestre (`extensoesNativas`; padrão visível). O painel de gerenciamento das Marcas é só do mestre. As regras do Firestore ainda não impedem um membro de outra mesa de gravar nas coleções das Marcas se chamar o Firestore à mão (blindagem planejada, ver plano de extensões).

## Spoilers e conteúdo sensível

- Gabaritos das Marcas ficam em `lore/` e `puzzles/` (só mestre). Os JSONs de origem (`lore-marcas*.json`, `puzzles-marcas*.json`) estão no `.gitignore`.
- A pasta `docs/rpg-especifico/` e `docs/temp/` não vão para o GitHub (`.gitignore`).
- Dados "não-spoiler" das Marcas (`marcas-data.ts`) podem ir no código por design.

## Ao mexer em permissões

Alterou regra, coleção ou rota? Atualize **esta página**, [arquitetura](arquitetura.md) (modelo de dados) e a feature afetada. Publique as regras (`firebase deploy --only firestore:rules,storage`).
