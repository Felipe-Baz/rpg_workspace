## 1. Modelo e dados

- [x] 1.1 Definir tipos `Cena`, `Camada`, `ObjetoCena`, `Asset` em `src/lib/cena/tipos.ts`
- [x] 1.2 Adicionar `origem?` e `cenaId?` ao `Mapa` sem alterar o restante
- [x] 1.3 CRUD de cenas em `mesas/{id}/cenas` e regras do Firestore (somente mestre)
- [x] 1.4 Implementar comandos com `aplicar`/`desfazer` e a pilha de undo/redo, com testes unitários

## 2. Render

- [x] 2.1 Ler o guia do Next sobre componentes cliente e importação dinâmica
- [x] 2.2 Integrar PixiJS carregado sob demanda
- [x] 2.3 Renderizar camadas, objetos e grid
- [x] 2.4 Exportar o render para imagem (lado maior até 4096 px) e enviar ao Storage

## 3. Editor

- [x] 3.1 Tela do editor: canvas, painel de camadas, barra de ferramentas
- [x] 3.2 Seleção e transformação de objetos (mover, escalar, rotacionar, espelhar)
- [x] 3.3 Upload de PNGs como assets e carimbo com snap ao grid
- [x] 3.4 Salvar com confirmação de alterações pendentes

## 4. Integração

- [x] 4.1 Escolha "Imagem ou Cena" em `MapasMestre` e selo "Cena" no cartão
- [x] 4.2 Garantir que `VisorMestre`, `MapasJogador` e `CamadaCobertura` não precisem de alteração

## 5. Verificação

- [x] 5.1 Teste de compatibilidade: cobertura, revelar, pinos e liberação em mapa de cena
- [x] 5.2 Teste: editar e salvar com coberturas existentes não as desloca
- [x] 5.3 Teste: remover `cenaId` mantém o mapa utilizável
- [x] 5.4 Medir desempenho com 500 objetos (3,69 ms/quadro com GPU sincronizada, 500 sprites visíveis)
