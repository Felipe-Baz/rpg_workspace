## 1. Contratos

- [ ] 1.1 Definir `ProvedorImagem`, `ProvedorLlm`, `CampoConfig` e `Capacidades`
- [ ] 1.2 Criar `registro.ts` e utilitários de consulta
- [ ] 1.3 Escrever a suíte de contrato com HTTP simulado

## 2. Provedores

- [ ] 2.1 Implementar o provedor de imagem Google Gemini (Nano Banana) com campos `apiKey` e `modelo`, e imagens de referência
- [ ] 2.2 Implementar o provedor LLM Google Gemini compartilhando a chave `google`, com tool use
- [ ] 2.2b Implementar o provedor LLM da Anthropic (Claude Sonnet) com credencial `anthropic`, campo `modelo`, visão e tool use no schema neutro
- [ ] 2.3 Definir o ponto de extensão `RemovedorFundo` e implementar `RemovedorFundoChroma` (cor-chave, tolerância e limpeza de bordas)
- [ ] 2.4 Confirmar na documentação oficial o ID do modelo e as capacidades reais do Gemini, e ajustar as capacidades declaradas

## 3. Servidor e segredos

- [ ] 3.1 Cifragem AES-GCM e variável de ambiente da chave mestra
- [ ] 3.2 Rotas: salvar chave, estado mascarado, testar conexão
- [ ] 3.3 Regra do Firestore negando leitura de `segredos`
- [ ] 3.4 Rota `POST /api/ia/gerar` com `exigirMestre`, sem log de chave

## 4. Interface

- [ ] 4.1 Tela de configuração de IA gerada a partir de `campos`
- [ ] 4.2 Botão "Testar conexão" mostrando capacidades
- [ ] 4.3 Seleção independente do provedor ativo de imagem e do de LLM, com a credencial de cada fabricante

## 5. Limites de gasto

- [ ] 5.1 Contador de uso e teto por mesa
- [ ] 5.2 Estimativa e confirmação para lotes
- [ ] 5.3 Painel de uso

## 6. Verificação

- [ ] 6.1 Provedor de exemplo adicionado com um arquivo e uma linha aparece na tela
- [ ] 6.2 Teste de que o cliente não lê segredos e jogador recebe 403
- [ ] 6.3 Teste de degradação (sem alfa, sem referências)
- [ ] 6.3b Teste de combinação mista: imagem Google com LLM Anthropic, cada um usando a própria credencial; trocar só o LLM sem afetar o de imagem
- [ ] 6.4 Validação manual com chave real: gerar 5 sprites e 2 texturas, conferir o recorte do chroma key e a consistência com uma referência, e registrar o resultado em `docs/validacao-gemini.md`
