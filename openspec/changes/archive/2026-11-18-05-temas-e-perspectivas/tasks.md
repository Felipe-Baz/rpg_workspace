## 1. Perspectivas

- [x] 1.1 Definir o tipo `Perspectiva` e o registro explícito
- [x] 1.2 Implementar top-down e uma segunda perspectiva (isométrica) com imagens de exemplo em `public/perspectivas/`
- [x] 1.3 Seletor com exemplos na criação de cenário; grid fixa top-down
- [x] 1.4 Ordenação de objetos no render conforme a perspectiva
- [x] 1.5 Bloquear troca de perspectiva com objetos presentes

## 2. Temas

- [x] 2.1 Tipo `Tema` e CRUD em `mesas/{id}/temas` com regras do Firestore
- [x] 2.2 Upload de referências para o Storage e extração de paleta no cliente
- [x] 2.3 Rota `POST /api/ia/analisar-tema` usando o LLM ativo
- [x] 2.4 Tela de tema: referências, texto, proposta editável, salvar
- [x] 2.5 Fluxo sem IA: preenchimento manual do perfil
- [x] 2.6 Impedir exclusão de tema em uso

## 3. Integração com a cena

- [x] 3.1 Escolha de tema e perspectiva ao criar mapa de cena
- [x] 3.2 Filtrar a paleta de assets por perspectiva

## 4. Verificação

- [x] 4.1 Teste: adicionar perspectiva nova só com arquivo, imagem e uma linha
- [x] 4.2 Teste: grid ignora o seletor; cenário aceita todas
- [x] 4.3 Teste: criar tema com e sem IA
- [x] 4.4 Teste: ordenação por Y em isométrica
