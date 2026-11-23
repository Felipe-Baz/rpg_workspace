# Fluxo: criar um mapa com IA

**Pré-requisito:** o mestre configurou a chave de um provedor em `/configuracoes/ia` (imagem + LLM) e testou a conexão. Ver [ia-configuracao-e-limites](../features/ia-configuracao-e-limites.md).

```
Tema → Nova cena (modo + perspectiva) → Assets (reusar ou gerar) → Chat com o agente → Revisar passos → Salvar/Render → Liberar ou Exportar
```

1. **Tema da mesa** (uma vez): texto + imagens de referência → o LLM propõe um perfil; o mestre revisa e salva. A paleta vem da extração local. [ia-temas-e-perspectivas](../features/ia-temas-e-perspectivas.md).
2. **Nova cena:** escolhe **grid** (perspectiva sempre top-down) ou **cenário** (escolhe perspectiva), tamanho e tema.
3. **Assets:** a biblioteca da mesa (e a pública) é consultada **antes de gerar**. Se faltar peça, o mestre gera (tipo, descrição, tags, variações) e acompanha o **job**; o resultado passa por remoção de fundo, recorte e verificação. [ia-assets](../features/ia-assets.md).
4. **Chat do agente:** o mestre pede em linguagem natural (pode selecionar objetos para edição pontual ou pedir **só sugerir**). O servidor responde em streaming com ferramentas e **passos**. [ia-agente-criador-de-mapas](../features/ia-agente-criador-de-mapas.md).
5. **Estimativa e confirmação:** se o plano pede geração de assets, o mestre vê a estimativa contra o **teto mensal** e confirma.
6. **Aplicar:** cada passo vira uma entrada de histórico (autoria IA). O mestre ajusta à mão; **desfazer/refazer** funciona sobre tudo. [editor-de-cena](../features/editor-de-cena.md).
7. **Salvar:** cena em `cenas/{id}` e **render** como mapa (`origem: "cena"`).
8. **Distribuir:** **liberar** aos jogadores (eles veem só o render) e/ou **exportar** `.uvtt`/`.dd2vtt` ([exportacao-vtt](../features/exportacao-vtt.md)).

**Falhas comuns**
- *Teto atingido:* mensagem com a opção de aumentar o teto.
- *Chave inválida/sem créditos:* erro saneado do provedor (sem expor a chave).
- *Job preso:* expira em 10 minutos e vira `falhou`.
