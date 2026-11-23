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
| Estado por escopo: `extensoes/{extId}/estado/mestre` | lê e grava | nada | Gabaritos e segredos da extensão |
| `extensoes/{extId}/estado/para_{uid}` | lê e grava | só o dono (`uid`) lê, com a extensão visível, ativa e `porJogador` em `estadoAprovado` | Conteúdo entregue a um jogador; jogador nunca lista a subcoleção |
| `extensoes/{extId}/estado/de_{uid}` | lê e apaga (nunca grava) | só o dono lê e grava, com a extensão visível, ativa e `doJogador` aprovado; chaves `json`/`uid`/`atualizadoEm`, `json` ≤ 50.000 | Escrita do jogador sem aprovação; o mestre não forja respostas |
| Registros de tipos de dado: `recursosDados/{id}` | lê e grava tudo | lê só `liberado == true` | O mestre libera cada registro |
| Pedidos de jogadores: `extensoesPedidos/{id}` | lê todos; aprova/recusa/apaga | cria e lê só os próprios (`de == uid`, `status: pendente`) | O jogador nunca grava conteúdo direto; o pedido é revalidado pelo mestre ao aprovar |
| Lotes criados por extensões: `extensoesLotes/{id}` | lê e grava | nada | Histórico para listar e desfazer |
| Extensões nativas: `extensoesNativas/{id}` | grava | lê (para saber o que mostrar) | Mestre pode ocultar as Marcas de Pacto dos jogadores; sem registro = visível |
| `uso`, `usoRegistros`, `jobs` | lê | nada | Só o servidor escreve (Admin SDK) |
| Marcas (todas as coleções) | só na mesa `MESA_PADRAO` | só na mesa `MESA_PADRAO` e se o mestre não ocultou | Exclusividade e ocultação impostas pelas regras do Firestore |
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
- **Efeitos na mesa:** tema só aceita tokens conhecidos com cor hexadecimal (nunca CSS livre); rótulos são limpos de marcação; contraste mínimo 4,5:1 entre texto e fundo; Início/Extensões/Configurações não se ocultam; o kill switch (`ativa`) desfaz tudo. A extensão não altera tema ou menu por script, só pelo manifesto que o mestre aprova.
- **IA na extensão:** `POST /api/ia/extensao-llm` exige token, ser membro da mesa, extensão ativa com `usar:ia` aprovada (e liberada, se o chamador for jogador); usa a chave do **mestre**; limite diário atômico por mesa; pergunta/resposta com tamanho máximo. A chave nunca chega ao navegador.
- **Importação de extensões:** o arquivo só traz código e manifesto, é validado e normalizado, e **não traz aprovações, estado, dono nem visibilidade**; o código roda no mesmo iframe isolado e as permissões continuam dependendo da aprovação do mestre.
- **Pedidos de jogador:** as regras exigem formato fixo (`hasOnly`), 1 a 20 ações, `status` pendente, nome ≤ 80.
- **Eventos:** só a visão do mestre executa automações, só com a mesa aberta, e cada evento exige a permissão `ler:*` aprovada; limite de 10 eventos/min por extensão e sem retorno ao autor do evento.
- **Leitura de dados da mesa pelo broker:** a extensão só lê o que o **mestre aprovou** (`permissoesAprovadas`) e, mesmo assim, apenas o que a **conta de quem usa** já pode ler (jogador não recebe dados de mestre). Pedidos são validados, limitados (20/s, 200 mil caracteres) e atendidos só ao próprio iframe. A **escrita** (`criar:fichas`, `criar:missoes`) é só do mestre: o jogador nunca cria conteúdo por extensão; cada pedido exige a **aprovação explícita** do mestre numa tela com o resumo, grava em lote atômico com `origem` e é desfazível. Os dados privados que a extensão guardar em `RPG.salvar` (escopo `compartilhado`) ficam visíveis a quem a usa, e o consentimento avisa disso. **Alterar/excluir** (`alterar:fichas`, `alterar:missoes`) segue a mesma aprovação, mostra o antes → depois, só alcança fichas do mestre e missões e o desfazer restaura a versão anterior.
- **Estado por escopo (E7):** os escopos `mestre`, `porJogador` e `doJogador` são protegidos **pelas regras** (não só pelo broker): o mestre aprova cada escopo (`estadoAprovado`, gravado só por ele); para jogadores, tudo fecha quando a extensão está oculta ou desligada. O jogador só alcança o próprio `para_`/`de_` (id do documento = uid, sem consulta). O HTML da extensão continua visível a quem a abre: segredos devem ir no escopo `mestre` (o criador oferece "Dados iniciais" para isso). A frequência de escrita do jogador é limitada só no broker; um cliente adulterado consegue apenas sobrescrever o próprio documento de 50 KB.
- Extensões **nativas** são bloqueadas **na interface** por mesa e, para o jogador, pela opção de ocultar do mestre (`extensoesNativas`; padrão visível). O painel de gerenciamento das Marcas é só do mestre. A exclusividade e a ocultação das Marcas são **impostas pelas regras do Firestore** (funções `mesaDasMarcas`, `marcasLiberadas`, `marcasMestre`, `marcasJogador`), não só pela interface; o id da mesa nas regras é conferido por teste contra `MESA_PADRAO`.

## Spoilers e conteúdo sensível

- Gabaritos das Marcas ficam em `lore/` e `puzzles/` (só mestre). Os JSONs de origem (`lore-marcas*.json`, `puzzles-marcas*.json`) estão no `.gitignore`.
- A pasta `docs/rpg-especifico/` e `docs/temp/` não vão para o GitHub (`.gitignore`).
- Dados "não-spoiler" das Marcas (`marcas-data.ts`) podem ir no código por design.

## Ao mexer em permissões

Alterou regra, coleção ou rota? Atualize **esta página**, [arquitetura](arquitetura.md) (modelo de dados) e a feature afetada. Publique as regras (`firebase deploy --only firestore:rules,storage`).
