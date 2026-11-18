## Context

Mapas de imagem não têm estrutura. A cena já aceita assets e objetos. O contrato de provedores prevê `inpainting` como capacidade opcional; segmentação ainda não existe como capacidade.

## Goals / Non-Goals

**Goals:**
- Converter o que for possível com revisão humana, sem prometer perfeição.
- Preservar integralmente o mapa original.
- Exportar para VTT de forma simples.

**Non-Goals:**
- Conversão automática sem revisão.
- Reconstruir paredes e luzes com precisão por visão computacional.

## Decisions

- **Nova capacidade** `segmentacao` no contrato de provedores, com ponto de extensão `Segmentador` (mesmo padrão: arquivo mais uma linha).
- **Fluxo**: segmentar → mestre revisa e nomeia máscaras (aceitar, descartar, juntar, dividir) → para cada objeto aceito, recortar sprite, fazer inpainting do buraco no fundo → criar assets e a cena.
- **Cópia, não migração**: cria novo `Mapa` de cena com `imagem` igual ao original (ou ao render da cena) e copia `zonas`, `cobertas` e pinos; o mapa original fica intacto.
- **Fundo**: camada de terreno única com o resultado do inpainting.
- **Exportação**: PNG em alta resolução com ou sem grid, mais JSON de metadados no formato Universal VTT quando há paredes e luzes definidas.
- **Sem inpainting disponível**: o objeto permanece na imagem de fundo e a conversão é parcial, com aviso.
- Jobs assíncronos e teto de gasto reaproveitados.

- **Provedor inicial Google Gemini:** a edição é por instrução, sem máscara explícita. Antes de implementar, confirmar se o Gemini serve como segmentador (máscaras por visão) e como removedor de objeto no fundo; caso contrário, esta fase exige um provedor extra cadastrado como extensão.

## Risks / Trade-offs

- Qualidade variável de segmentação e inpainting → revisão manual obrigatória e prévia lado a lado.
- Custo por objeto → estimativa e limite de objetos por conversão.
- Objetos parcialmente ocultos geram sprites incompletos → marcar como "incompleto" e permitir regenerar por IA.
