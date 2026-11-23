# Fluxo: criar e publicar uma extensão

**Pré-requisito:** LLM configurado em `/configuracoes/ia` (usa a chave do mestre).

```
Extensões → Criar → Chat + prévia → Manifesto (encaixes + permissões) → Salvar na biblioteca → Publicar na mesa (aprovar permissões) → (Liberar aos jogadores)
```

1. **Extensões → Criar** (`/mesas/{id}/extensoes/criar`): tela de chat à esquerda e **prévia ao vivo** do iframe.
2. O mestre descreve a ferramenta. A IA pode fazer **uma pergunta curta** se o pedido estiver vago; senão devolve o **HTML completo** e um **manifesto** com os encaixes (padrão: só `sidebar`).
3. A prévia roda no sandbox (sem rede). O mestre pede ajustes; cada resposta substitui o HTML atual.
4. **Manifesto:** o mestre edita *onde aparece* (sidebar, diário do jogador, visão geral, sessão ao vivo, Ctrl+K) e para quem (mestre/jogador), e *o que ela pode ler* (jogadores, missões, fichas…). A IA só propõe; o mestre decide. Na prévia, as permissões são simuladas e dá para escolher dados **da mesa** ou **de exemplo**; um registro mostra o que a extensão leu.
5. **Salvar** guarda o rascunho na **biblioteca do mestre** (reaproveitável); **Publicar na mesa** instala uma cópia em `mesas/{id}/extensoes`. Se a extensão pede permissões novas, o mestre as **aprova** antes (consentimento); vale só o aprovado (`permissoesAprovadas`).
6. **Visibilidade:** o mestre decide se os jogadores veem (`visivelJogadores`). A extensão aparece na sidebar (etiqueta "Extensão") e nos encaixes escolhidos.
7. **Uso:** o mestre abre a extensão, e `RPG.salvar` persiste o estado (≤ 50 KB). O jogador a usa em **somente leitura**.
8. **Editar depois:** `/extensoes/{extId}/editar` reabre o chat com o histórico. **Arquivar** a tira da lista; **excluir da biblioteca** não remove cópias já instaladas em mesas.

**Reuso:** em outra mesa, a lista de Extensões mostra a biblioteca do mestre e permite instalar nela uma cópia (`publicarNaMesa`), repetindo a aprovação de permissões.

Detalhes e limites: [extensoes](../features/extensoes.md).
