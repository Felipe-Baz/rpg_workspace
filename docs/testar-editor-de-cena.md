# Testar o editor de cena e medir o desempenho (tarefa 5.4)

## 0. Corrigir o erro `textura: TypeError: Failed to fetch`

Esse erro é **CORS do bucket do Storage**, não um bug de código. O editor baixa o PNG com `fetch` para
criar a textura do PixiJS, e o Storage só responde a `fetch` de outra origem se o bucket tiver CORS configurado.
As miniaturas do painel de assets aparecem mesmo assim porque `<img>` não exige CORS.

O mesmo CORS é necessário para salvar a cena, porque a exportação do render lê os pixels do canvas.

### Aplicar o CORS

1. Confira a origem em `storage-cors.json` (na raiz). Por padrão é `http://localhost:3000`.
   Se o `next dev` usar outra porta, ajuste. Para produção, adicione o domínio do app.
2. Descubra o nome do bucket: é o valor de `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` no `.env.local`
   (por exemplo `meu-projeto.firebasestorage.app`).
3. Aplique, com o Google Cloud SDK instalado e logado no projeto (`gcloud auth login`):

   ```bash
   gcloud storage buckets update gs://SEU_BUCKET --cors-file=storage-cors.json
   ```

   Alternativa: `gsutil cors set storage-cors.json gs://SEU_BUCKET`.
4. Confira: `gcloud storage buckets describe gs://SEU_BUCKET --format="default(cors_config)"`.
5. **Recarregue a página** (Ctrl+Shift+R). O editor guarda a falha de carregamento da textura
   até a página ser recarregada.

Se ainda falhar, abra o DevTools (aba Network), clique no PNG e veja a resposta. Ela deve ter o cabeçalho
`access-control-allow-origin`. Sem ele, a origem do app não bate com a do `storage-cors.json`.

### Regras do Storage

Faça também o deploy das regras alteradas, para o JSON de cenas grandes e para o acesso de membros:

```bash
firebase deploy --only firestore:rules,storage
```

## 1. Preparar o teste

1. `npm run dev`
2. Entre como mestre, abra a mesa, vá em **Mapas** e clique em **+ Nova cena** (grid quadrado, 30x20).
3. Na cena aberta, clique em **+ Enviar PNG** e envie **um** PNG com transparência (qualquer um serve).
4. Rode o teste de desempenho:
   1. Clique no asset enviado para selecioná-lo (borda roxa).
   2. Clique no canvas: um carimbo aparece e o PNG carregou sem erro (Network não mostra falha).
   3. Se o objeto não aparecer, volte ao passo 0.

## 2. Medir com 500 objetos

O botão **⏱ 500 objetos** na barra superior só existe em dev (`npm run dev`) e usa o primeiro asset da lista.

1. Clique em **⏱ 500 objetos**.
2. O botão cria 500 objetos em posições e rotações aleatórias, só na tela, sem entrar no histórico nem ser salvo.
   Depois de 300 ms, ele redesenha 60 quadros seguidos.
3. A barra mostra algo como `500 objetos: 2.10 ms/quadro (476 fps máx.)`.
4. Para repetir, recarregue a página sem salvar. A cena salva não é alterada.

### Critério de aceite (design.md)

- **Meta:** 60 fps com 500 objetos, ou seja, **≤ 16,6 ms/quadro**.
- Se passar com folga (por exemplo ≤ 8 ms), marque a tarefa 5.4 em
  `openspec/changes/03-mapas-cena-editor-manual/tasks.md` (`- [x] 5.4`).
- Se passar de 16,6 ms, anote o valor e o hardware. A mitigação prevista no design é culling e atlas de sprites.

### Ressalvas

- A medição é o custo de `render()` do Pixi (CPU e envio de comandos para a GPU). Ela não mede
  o tempo de arrastar na tela. Para isso, abra o DevTools → Performance, grave 5 s arrastando
  um objeto e veja os FPS.
- Teste também em um celular ou numa máquina mais fraca, porque o limite de 4096 px existe
  por causa deles.
- Com um canvas muito grande (por exemplo 100x100 células), o custo vem mais do grid do que dos objetos.
  Meça no tamanho padrão e depois num grande.

## 3. Roteiro rápido de verificação manual

| Ação | Esperado |
| --- | --- |
| Carimbar com grid + Snap ligado | O objeto cai no centro da célula |
| Arrastar com Alt | Ignora o snap |
| Alça roxa inferior direita | Redimensiona |
| Alça redonda acima do topo | Rotaciona (Shift trava em 15°) |
| Ctrl+Z / Ctrl+Shift+Z | Desfaz e refaz cada gesto como um único passo |
| Travar a camada ativa e carimbar | Erro "camada oculta ou travada" |
| Salvar | O cartão do mapa mostra a nova imagem e o editor fica em "Salvo" |
| Fechar com alterações | Pede confirmação |
| Abrir o visor e criar uma cobertura | Funciona como num mapa de imagem |
| Salvar de novo após cobrir | A cobertura não se desloca |
| Liberar para um jogador | O jogador vê só a imagem renderizada |
