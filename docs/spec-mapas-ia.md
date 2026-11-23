# Spec: Criador de mapas com IA

Status: planejamento. Nenhum código escrito.
Antes de implementar, ler `node_modules/next/dist/docs/` (Next 16, ver `AGENTS.md`).

## 1. Objetivo

Dar ao mestre um editor de mapas em cenas (camadas e objetos, estilo Inkarnate) em que uma IA cria objetos, mapas e ajustes pontuais. O mestre pode, para cada mapa, escolher entre:

- **Mapa de imagem** (como hoje): sobe uma imagem.
- **Mapa de cena** (novo): cria no editor, com ou sem IA.

Tudo que é feito sobre o mapa depois (zonas de cobertura, revelar, pinos, liberação para jogadores, notas) funciona igual nos dois casos, sem alteração.

## 2. Princípio: o mapa de cena é um mapa de imagem com uma fonte editável

Hoje `Mapa` tem `imagem`, `zonas`, `cobertas`, `todos`, `liberadoPara`, e os pinos dos jogadores ficam em `mesas/{id}/pinos/{uid}`. Todos os consumidores (`VisorMestre`, `MapasJogador`, `CamadaCobertura`) só leem `imagem` e usam coordenadas em fração 0–1.

Regra de compatibilidade:

- Adicionar ao `Mapa` apenas campos opcionais: `origem?: "imagem" | "cena"` (ausente = `"imagem"`) e `cenaId?: string`.
- Mapa de cena mantém `imagem` sempre preenchida com o **render achatado** da cena. Pode ser uma URL do Storage, pois quem consome só usa como `src`.
- A cena fica em `mesas/{id}/cenas/{cenaId}`, separada. Zonas, coberturas e pinos continuam no `Mapa`/`pinos`, nunca na cena.
- Consequência: nenhum código existente de zonas/jogadores precisa saber se o mapa é de cena.
- Cuidado: coberturas e pinos são frações da imagem. Depois que o mapa existe, o **aspect ratio do canvas fica travado**. Mudar o tamanho exige reescalar ou avisar que coberturas serão perdidas. Re-renderizar a cena com o mesmo aspect ratio não desloca nada.
- Teste de aceitação: apagar `cenaId` de um mapa de cena deixa ele funcionando como mapa de imagem comum.

## 3. Modelo de cena

```
Cena
├─ canvas: { largura, altura (px lógicos), aspect travado após criação }
├─ modo: "grid" | "cenario"
├─ grid?: { tipo: quadrado | hex, celula, offset, visivel }
├─ perspectivaId        (ver seção 6)
├─ temaId               (ver seção 5)
└─ camadas[] (ordem, visivel, travada, opacidade)
    ├─ terreno   → regiões com máscara + texturaId
    ├─ caminhos  → paredes, rios, estradas (polilinha/curva + pincelId)
    ├─ decals    → manchas, folhas, sangue
    ├─ objetos   → { id, assetId, x, y, escala, rot, flip, tint, z }
    ├─ luz       → luzes e sombras
    └─ rotulos
```

Coordenadas de cena em fração 0–1 do canvas, para casar com cobertas/pinos.

Mutações são comandos (adicionar, mover, remover, alterar). A UI e a IA usam o mesmo conjunto de comandos, o que dá undo/redo único e histórico.

## 4. Assets

Tipos: `sprite` (PNG com alfa), `textura` (repetível), `pincel` (caminho), `decal`.

- Cada asset: `{ id, tipo, tags, temaId, perspectivaId, escalaBase, urlStorage, geradoPor (provedor/modelo/prompt) }`.
- Biblioteca por mesa (opcionalmente copiar entre mesas do mesmo mestre).
- Reuso é a regra: o agente busca por tag antes de gerar. Isso garante consistência de estilo e reduz custo.
- Assets valem para uma perspectiva só (um carvalho top-down não serve em isométrico).
- Pipeline de sprite: gerar → remover fundo (se o provedor não entregar alfa) → recortar → normalizar escala → salvar.

## 5. Tema da mesa

- Entrada: imagens de referência e texto.
- Um modelo de visão gera o **perfil de estilo**: descrição, paleta, regras, termos proibidos e 2 a 4 imagens âncora.
- Toda geração injeta o perfil e as âncoras, conforme a capacidade do provedor.
- Uma mesa pode ter vários temas. Cada mapa referencia um.

## 6. Perspectivas (cadastráveis)

- Mapas em **grid**: sempre top-down.
- Mapas de **cenário**: o mestre escolhe qualquer perspectiva cadastrada, vendo uma imagem de exemplo de cada.

Uma perspectiva é um módulo declarativo, sem lógica espalhada pelo sistema:

```ts
interface Perspectiva {
  id: string;                 // "topdown", "isometrica", "lateral", ...
  nome: string;
  imagemExemplo: string;      // mostrada no seletor
  fragmentoPrompt: string;    // injetado nas gerações
  ordenacao: "nenhuma" | "porY" | "porZ";   // regra de z-order no render
  projecaoGrid?: "plana" | "isometrica";
  permiteGrid: boolean;       // false para laterais, por exemplo
}
```

Adicionar perspectiva = um arquivo em `src/lib/mapas-ia/perspectivas/` + imagem de exemplo + uma linha no registro.

## 6.1 Provedores de IA (configuração da conta do mestre)

Dois pontos de extensão, ambos com **Strategy + Registry + Adapter**:

```ts
interface ProvedorImagem {
  id: string; nome: string;
  campos: CampoConfig[];                       // ex.: apiKey, modelo, endpoint (gera o form de config)
  capacidades: {
    alfaNativo: boolean; imagensReferencia: boolean;
    inpainting: boolean; seed: boolean; tamanhos: Tamanho[];
  };
  gerar(req: PedidoImagem, cfg: ConfigProvedor): Promise<ResultadoImagem>;
  editar?(req: PedidoEdicao, cfg: ConfigProvedor): Promise<ResultadoImagem>;   // opcional
}

interface ProvedorLlm {   // orquestra o agente por tool use; schema de ferramentas neutro
  id: string; nome: string; campos: CampoConfig[];
  conversar(req: PedidoLlm, cfg: ConfigProvedor): Promise<RespostaLlm>;
}
```

Regras:

- **Adicionar provedor = um arquivo** em `src/lib/mapas-ia/provedores/imagem/` ou `.../llm/` que exporta o objeto, mais **uma linha** no `registro.ts`. (O bundler do Next não faz auto-descoberta de pasta de forma portável; um script de geração opcional pode escanear a pasta, mas começar com registro explícito.)
- A tela de configuração é **gerada a partir de `campos`**. Um provedor novo não exige código de UI.
- O resto do sistema só fala com a interface. As **capacidades** definem degradação:
  - sem `alfaNativo` → etapa de remoção de fundo (também um ponto de extensão `RemovedorFundo`);
  - sem `imagensReferencia` → o perfil de estilo vai só como texto;
  - sem `inpainting` → "regenerar objeto" gera o sprite inteiro de novo.
- Conformidade: uma suíte de testes de contrato que todo provedor roda (com mock de HTTP).
- Provedor de imagem e provedor de LLM são **independentes** e podem ser de fabricantes diferentes (por exemplo Gemini para imagem e Claude Sonnet como LLM); credenciais por fabricante, todas na mão do mestre. Provedor inicial de imagem: **Google Gemini (Nano Banana)**; adaptadores LLM iniciais: Google e Anthropic. O spike comparativo foi adiado; outros provedores entram depois como extensões.

### Chaves por mestre (BYOK)

- Cada mestre cadastra suas chaves; elas nunca vão para outros usuários nem para o bundle do cliente.
- Guardar em `usuarios/{uid}/segredos/{provedorId}`, cifradas no servidor (AES-GCM, chave mestra em variável de ambiente), com regra do Firestore que **proíbe leitura direta pelo cliente**. A UI só vê "configurada / não configurada" e os 4 últimos caracteres.
- Toda chamada de IA passa por rota de servidor (`app/api/...`) que valida o ID token do Firebase, lê e decifra a chave do **mestre dono** da mesa, chama o provedor e nunca registra a chave em log.
- Cotas e limites por mesa para evitar gastos acidentais do próprio mestre (tetos configuráveis).

## 7. Agente e ferramentas

O LLM escolhido orquestra; o modelo de imagem só gera pixels.

Ferramentas (schema neutro, convertido pelo adapter do provedor):

`criar_tema`, `buscar_asset`, `gerar_asset`, `gerar_textura`, `pintar_terreno`, `tracar_caminho`, `colocar_objeto`, `espalhar(região, densidade)`, `editar_objeto`, `remover`, `definir_grid`, `adicionar_luz`, `rotular`, `regenerar_objeto`.

- Cada chamada vira um comando da cena (desfazível).
- O agente recebe a seleção atual do editor como contexto.
- Tarefas longas rodam como **jobs** (`mesas/{id}/jobs/{id}`, status por `onSnapshot`).

## 8. Editor

- PixiJS (a confirmar na fase 1) para renderizar muitos objetos.
- Painel de camadas, seleção, transformação, pincéis, carimbos, grid com snap, undo/redo, chat da IA lateral.
- "Salvar" = persistir a cena e re-renderizar `imagem` (mesmo aspect ratio).
- Mapas de imagem continuam com o fluxo atual, sem passar pelo editor.

## 9. Infraestrutura

- Migrar o projeto Firebase para **Blaze** (aprovado).
- Firebase Storage: assets, renders, imagens de referência. Regras de Storage espelhando o acesso por mesa.
- `firebase-admin` nas rotas de servidor (verificação de token, leitura de segredos).
- Atualizar `firestore.rules` para `cenas`, `jobs`, `segredos` (leitura direta negada).
- Observação: hoje `comprimirImagem` limita a ~900 KB em data URL. Mapas de cena usam URL do Storage e não sofrem esse limite. Mapas de imagem podem seguir como estão.

## 10. Fases

0. **Spike (1–2 dias):** comparar provedores de imagem em consistência de estilo com referências, PNG transparente e estabilidade de perspectiva. Define quais provedores iniciais entregamos.
1. **Cena + editor manual:** tipo `Cena`, `origem` no `Mapa`, render para `imagem`, upload manual de assets, undo/redo, **teste de compatibilidade com zonas e jogadores**.
2. **Camada de provedores + configuração:** interfaces, registro, tela gerada por `campos`, segredos cifrados, rota de servidor, Blaze/Storage.
3. **Tema + geração de assets:** perfil de estilo, biblioteca, pipeline de sprite/textura, perspectivas e seletor com exemplos.
4. **Agente:** ferramentas, jobs, edição por conversa, mapas grid e cenário.
5. **Avançado:** luz/visão, importar imagem pronta para camadas (SAM + inpainting, melhor esforço), exportação para VTT.

## 11. Riscos

| Risco | Mitigação |
|---|---|
| Consistência de estilo | referências como entrada, perfil fixo, reuso de assets |
| Escala/perspectiva dos sprites | prompts padronizados por perspectiva, normalização na pipeline |
| Provedores sem alfa/inpainting | capacidades declaradas e degradação |
| Vazamento de chave | cifragem, leitura só no servidor, sem log |
| Custo na conta do mestre | cotas por mesa e estimativa antes de gerar em lote |
| Mudança de canvas quebrar coberturas | aspect ratio travado |
