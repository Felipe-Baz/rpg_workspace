## 1. Capacidades de provedor

- [x] 1.1 Adicionar a capacidade `segmentacao` e o ponto de extensão `Segmentador` ao contrato
- [x] 1.2 Implementar um segmentador e confirmar o inpainting do provedor ativo
- [x] 1.3 Rotas `POST /api/ia/segmentar` e `POST /api/ia/inpaint` com teto de gasto

## 2. Conversão

- [x] 2.1 Ação "Converter em cena" criando um novo mapa e preservando o original
- [x] 2.2 Copiar zonas, coberturas e pinos para o novo mapa
- [x] 2.3 Recorte dos sprites, inpainting do fundo e criação de assets e objetos
- [x] 2.4 Fluxo parcial quando o provedor não suporta inpainting

## 3. Revisão

- [x] 3.1 Tela de revisão de máscaras: aceitar, descartar, juntar, dividir, nomear
- [x] 3.2 Prévia lado a lado e estimativa de custo com limite de objetos
- [x] 3.3 Marcar objetos incompletos e permitir regenerar por IA

## 4. Exportação

- [x] 4.1 Exportar PNG em alta resolução com e sem grid
- [x] 4.2 Exportar metadados em formato Universal VTT (grid, paredes, luzes)

## 5. Verificação

- [x] 5.1 Teste: converter mapa com coberturas mantém zonas e original intacto
- [x] 5.2 Teste: mover objeto convertido não deixa buraco
- [x] 5.3 Teste: falha no meio não publica mapa parcial
- [x] 5.4 Teste: exportação com e sem paredes
