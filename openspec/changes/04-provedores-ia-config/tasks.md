## 1. Contratos

- [x] 1.1 Definir `ProvedorImagem`, `ProvedorLlm`, `CampoConfig` e `Capacidades`
- [x] 1.2 Criar `registro.ts` e utilitários de consulta
- [x] 1.3 Escrever a suíte de contrato com HTTP simulado

## 2. Provedores

- [x] 2.1 Implementar o provedor de imagem Google Gemini (Nano Banana) com campos `apiKey` e `modelo`, e imagens de referência
- [x] 2.2 Implementar o provedor LLM Google Gemini compartilhando a chave `google`, com tool use
- [x] 2.2b Implementar o provedor LLM da Anthropic (Claude Sonnet) com credencial `anthropic`, campo `modelo`, visão e tool use no schema neutro
- [x] 2.3 Definir o ponto de extensão `RemovedorFundo` e implementar `RemovedorFundoChroma` (cor-chave, tolerância e limpeza de bordas)
- [x] 2.4 Confirmar na documentação oficial o ID do modelo e as capacidades reais do Gemini, e ajustar as capacidades declaradas
- [x] 2.5 Escolher a cor-chave por asset (paleta via LLM com fallback heurístico) e pedi-la no prompt de imagem

## 3. Servidor e segredos

- [x] 3.1 Cifragem AES-GCM e variável de ambiente da chave mestra
- [x] 3.2 Rotas: salvar chave, estado mascarado, testar conexão
- [x] 3.3 Regra do Firestore negando leitura de `segredos`
- [x] 3.4 Rota `POST /api/ia/gerar` com `exigirMestre`, sem log de chave

## 4. Interface

- [x] 4.1 Tela de configuração de IA gerada a partir de `campos`
- [x] 4.2 Botão "Testar conexão" mostrando capacidades
- [x] 4.3 Seleção independente do provedor ativo de imagem e do de LLM, com a credencial de cada fabricante

## 5. Limites de gasto

- [x] 5.1 Contador de uso e teto por mesa
- [x] 5.2 Estimativa e confirmação para lotes
- [x] 5.3 Painel de uso

## 6. Verificação

- [x] 6.1 Provedor de exemplo adicionado com um arquivo e uma linha aparece na tela
- [x] 6.2 Teste de que o cliente não lê segredos e jogador recebe 403
- [x] 6.3 Teste de degradação (sem alfa, sem referências)
- [x] 6.3b Teste de combinação mista: imagem Google com LLM Anthropic, cada um usando a própria credencial; trocar só o LLM sem afetar o de imagem
- [x] 6.4 Validação manual com chave real: gerar 5 sprites e 2 texturas, conferir o recorte do chroma key e a consistência com uma referência, e registrar o resultado em `docs/validacao-gemini.md`
