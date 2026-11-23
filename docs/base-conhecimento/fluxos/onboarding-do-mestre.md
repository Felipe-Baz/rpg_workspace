# Fluxo: onboarding do mestre

**Objetivo:** de "nunca usei" a "tenho uma mesa pronta para convidar".

```
Landing (/) → Cadastro/Login (/login) → Dashboard (/mesas) → Nova mesa (wizard) → Visão geral (/mesas/{id})
```

1. **Landing:** apresenta a proposta e leva a "Começar"/"Entrar".
2. **Cadastro/Login:** e-mail+senha ou Google. **Não pergunta o papel** (mestre/jogador é por mesa). Ver [contas-e-acesso](../features/contas-e-acesso.md).
3. **Dashboard `/mesas`:** lista as mesas por status. Sem mesas, mostra o convite para criar a primeira.
4. **Nova mesa:** wizard de uma tela. Só o **nome** é obrigatório; sistema, descrição, cor e status têm padrão. Gera o **código de convite**.
5. **Visão geral:** checklist de primeiros passos: *definir o sistema*, *convidar/adicionar jogadores*, *registrar a primeira sessão*, cada um com atalho.
6. **Depois:** o mestre monta a campanha (Mundo, Fichas, Missões, Mapas) e, se quiser IA, configura a chave em `/configuracoes/ia` ([ia-configuracao-e-limites](../features/ia-configuracao-e-limites.md)).

**Pontos de atenção**
- A mesa nasce com o mestre como único membro; jogadores entram pelo código.
- IA é opcional: sem chave, mapas por upload e editor manual funcionam normalmente.
- Sem Storage configurado, imagens ficam no documento (~900 KB).

Veja: [mesas-e-convites](../features/mesas-e-convites.md), [navegacao-e-busca](../features/navegacao-e-busca.md).
