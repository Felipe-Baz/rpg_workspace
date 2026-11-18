## 1. Modelo e dados

- [ ] 1.1 Definir tipos `Cena`, `Camada`, `ObjetoCena`, `Asset` em `src/lib/cena/tipos.ts`
- [ ] 1.2 Adicionar `origem?` e `cenaId?` ao `Mapa` sem alterar o restante
- [ ] 1.3 CRUD de cenas em `mesas/{id}/cenas` e regras do Firestore (somente mestre)
- [ ] 1.4 Implementar comandos com `aplicar`/`desfazer` e a pilha de undo/redo, com testes unitários

## 2. Render

- [ ] 2.1 Ler o guia do Next sobre componentes cliente e importação dinâmica
- [ ] 2.2 Integrar PixiJS carregado sob demanda
- [ ] 2.3 Renderizar camadas, objetos e grid
- [ ] 2.4 Exportar o render para imagem (lado maior até 4096 px) e enviar ao Storage

## 3. Editor

- [ ] 3.1 Tela do editor: canvas, painel de camadas, barra de ferramentas
- [ ] 3.2 Seleção e transformação de objetos (mover, escalar, rotacionar, espelhar)
- [ ] 3.3 Upload de PNGs como assets e carimbo com snap ao grid
- [ ] 3.4 Salvar com confirmação de alterações pendentes

## 4. Integração

- [ ] 4.1 Escolha "Imagem ou Cena" em `MapasMestre` e selo "Cena" no cartão
- [ ] 4.2 Garantir que `VisorMestre`, `MapasJogador` e `CamadaCobertura` não precisem de alteração

## 5. Verificação

- [ ] 5.1 Teste de compatibilidade: cobertura, revelar, pinos e liberação em mapa de cena
- [ ] 5.2 Teste: editar e salvar com coberturas existentes não as desloca
- [ ] 5.3 Teste: remover `cenaId` mantém o mapa utilizável
- [ ] 5.4 Medir desempenho com 500 objetos
