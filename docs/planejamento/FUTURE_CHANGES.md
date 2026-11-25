# FUTURE_CHANGES: ideias adiadas

> Lista de ideias e melhorias **conscientemente deixadas para depois**, para não se perderem. **Nada aqui está planejado em detalhe nem tem data.** Quando uma ideia for priorizada, ela vira um planejamento em `docs/planejamento/` e sai daqui. Itens ligados ao combate nasceram de [`tracking-de-combate.md`](tracking-de-combate.md).

## Tracking de combate: V2

Escopo reservado para uma segunda versão da extensão (a V1 são as Fases 0 a 9 do plano).

### Visão, luz e névoa de guerra
- **Linha de visão e luz** a partir das `paredes` da cena (e paredes desenhadas sobre mapa-imagem calibrado).
- **Visão por token:** normal, no escuro, vidência; luz de tochas e magias (objeto `@luz`), escuridão mágica.
- **Névoa de guerra por jogador** (o que cada um já viu), revelada ao andar; o mestre revela/oculta à mão.
- Pontos a decidir quando chegar a hora: reaproveitar o editor de paredes da cena, custo de recalcular visão em tempo real, e o que o jogador vê de tokens fora do alcance.

### Cobertura automática
- Meia, três quartos e total entre atacante e alvo, por geometria e paredes, sempre sobrescrevível pelo mestre (na V1 a cobertura é marcada à mão).

## Tracking de combate: outras ideias

### Mapa no celular
- Gestos próprios no mapa de combate (pinça/zoom, arrastar token com o dedo, seleção de alvo e de área), layout de painéis para telas pequenas. A ficha já tem modo combate para celular; o mapa ainda não. Na V1 a verificação é só em desktop.

### Aplicação sem o mestre online
- Rota de servidor (`/api/combate/aplicar`, padrão `exigirMestre`/admin SDK) para aplicar solicitações **fora da sessão**. Hoje a aprovação do mestre é obrigatória e acontece com ele online; só faz sentido se surgir caso de uso fora de sessão, e exigiria rever a regra de aprovação.

### Ideias soltas (não priorizadas)
- Configuração para o jogador desfazer a **própria** ação logo após aplicar (hoje o undo é do mestre).
- Replays e resumos narrativos gerados por IA a partir do log do combate.
- Compartilhar encontros e macros entre mestres (biblioteca pública), além da exportação/importação entre mesas do mesmo mestre.
- Modo "espectador" para jogadores ausentes.

## Como usar este arquivo
- Adicione a ideia com um título curto, o **porquê** e o que precisaria ser decidido.
- Ao priorizar, mova para um planejamento próprio e remova daqui (ou marque como "movido para `<arquivo>`").
- Isto é planejamento: não vai para a base de conhecimento como se já existisse.
