## 1. Perspectivas

- [ ] 1.1 Definir o tipo `Perspectiva` e o registro explícito
- [ ] 1.2 Implementar top-down e uma segunda perspectiva (isométrica) com imagens de exemplo em `public/perspectivas/`
- [ ] 1.3 Seletor com exemplos na criação de cenário; grid fixa top-down
- [ ] 1.4 Ordenação de objetos no render conforme a perspectiva
- [ ] 1.5 Bloquear troca de perspectiva com objetos presentes

## 2. Temas

- [ ] 2.1 Tipo `Tema` e CRUD em `mesas/{id}/temas` com regras do Firestore
- [ ] 2.2 Upload de referências para o Storage e extração de paleta no cliente
- [ ] 2.3 Rota `POST /api/ia/analisar-tema` usando o LLM ativo
- [ ] 2.4 Tela de tema: referências, texto, proposta editável, salvar
- [ ] 2.5 Fluxo sem IA: preenchimento manual do perfil
- [ ] 2.6 Impedir exclusão de tema em uso

## 3. Integração com a cena

- [ ] 3.1 Escolha de tema e perspectiva ao criar mapa de cena
- [ ] 3.2 Filtrar a paleta de assets por perspectiva

## 4. Verificação

- [ ] 4.1 Teste: adicionar perspectiva nova só com arquivo, imagem e uma linha
- [ ] 4.2 Teste: grid ignora o seletor; cenário aceita todas
- [ ] 4.3 Teste: criar tema com e sem IA
- [ ] 4.4 Teste: ordenação por Y em isométrica
