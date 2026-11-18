## 1. Ferramentas

- [ ] 1.1 Definir o tipo `Ferramenta` e o registro de ferramentas com schema de argumentos
- [ ] 1.2 Implementar `buscar_asset`, `colocar_objeto`, `editar_objeto`, `remover`
- [ ] 1.3 Implementar `pintar_terreno`, `tracar_caminho`, `definir_grid`, `rotular`, `adicionar_luz`
- [ ] 1.4 Implementar `espalhar` determinístico com amostragem de Poisson
- [ ] 1.5 Implementar `gerar_asset` ligado aos jobs e ao teto de gasto
- [ ] 1.6 Testes unitários de cada ferramenta (válido, inválido, desfazer)

## 2. Orquestração

- [ ] 2.1 Ler o guia do Next sobre route handlers e streaming
- [ ] 2.2 Resumo textual da cena e do contexto enviados ao LLM
- [ ] 2.3 Rota `POST /api/ia/agente` com `exigirMestre`, limites de passos e tempo
- [ ] 2.4 Plano em passos com comandos propostos, em streaming

## 3. Interface

- [ ] 3.1 Painel de chat no editor com contexto de seleção
- [ ] 3.2 Prévia do plano, executar tudo ou passo a passo, e modo "só sugerir"
- [ ] 3.3 Estimativa e confirmação para passos que geram assets
- [ ] 3.4 Autoria dos comandos, histórico agrupado em passos e reverter ações da IA

## 4. Composição

- [ ] 4.1 Fluxo "criar mapa por descrição" em grid (dimensões em células)
- [ ] 4.2 Fluxo de cenário respeitando a ordenação da perspectiva
- [ ] 4.3 Validação geométrica das propostas (limites e colisões)

## 5. Verificação

- [ ] 5.1 Teste com LLM simulado: taverna 30x20 gera cena válida
- [ ] 5.2 Teste: pedido "deixe maior" altera só a seleção
- [ ] 5.3 Teste: remover mesas do canto não altera o resto
- [ ] 5.3b Teste: agente funcionando com dois LLMs diferentes (Google e Anthropic) sem alteração no código do agente
- [ ] 5.4 Teste: mapa gerado por IA continua com coberturas, revelar e pinos funcionando
