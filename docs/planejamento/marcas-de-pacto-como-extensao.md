# Marcas de Pacto como extensão comum (especificação para recriar)

> **Status: plano.** Hoje as Marcas de Pacto são uma **extensão nativa** em React (`src/components/marcas/*`, ver [base: marcas-de-pacto](../base-conhecimento/features/marcas-de-pacto.md)). Este documento descreve tudo o que é preciso para recriá-las **idênticas** como uma **extensão comum** (um HTML único no iframe), usando as peças do E7 (estado por escopo). Ele serve de briefing para o **criador de extensões com IA** e de checklist para conferir o resultado.
>
> **Sem spoilers aqui.** A lista pública das Marcas (nome, "o que foi vendido", build) e as atmosferas já estão no código e são visíveis ao jogador por design. A **lore** (mecânica real) e os **enigmas com gabarito** ficam nos JSONs locais (`jsons/lore-marcas.json`, `jsons/puzzles-marcas.json`), que **nunca** entram no HTML: eles são importados pelo mestre para o escopo `mestre`.

---

## 1. Resumo do que a extensão faz

- Cada jogador recebe do mestre uma **Marca** (poder obtido ao vender algo de si).
- O jogador vê **só a própria Marca** (sigilo, nome, "Você vendeu…", build), escreve **anotações** (Passiva, Fardo, Habilidade, Evolução da Marca, Post-its) e resolve **enigmas** liberados em etapas pelo mestre.
- Cada etapa pode ter uma **mecânica jogável** (cifra, lanterna, rastros, morse, fragmentos, relógio, runas, escolha, espera). A solução é conferida **por hash** no navegador do jogador; o texto da solução nunca chega a ele.
- Depois da mecânica, o jogador escreve uma **resposta**; o mestre dá o **veredito** (`aprovada` / `recusada`, com nota opcional).
- O mestre tem um **painel**: atribuir Marcas, liberar/recolher etapas, ver respostas e julgar, ler as anotações de todos, importar lore e enigmas, consultar o gabarito de cada Marca.

---

## 2. Manifesto

```json
{
  "versao": 1,
  "encaixes": [
    { "slot": "sidebar",        "rotulo": "Marcas de Pacto", "papeis": ["mestre", "jogador"] },
    { "slot": "diario.jogador", "rotulo": "Marcas de Pacto", "papeis": ["jogador"], "altura": 900 },
    { "slot": "ctrlk",          "rotulo": "Marcas de Pacto", "papeis": ["mestre", "jogador"] }
  ],
  "permissoes": ["ler:jogadores"],
  "eventos": [],
  "estado": ["mestre", "porJogador", "doJogador"],
  "mesa": {}
}
```

- **Sem bloco `mesa`:** a nativa não muda o tema da mesa inteira; o tema sombrio vale só dentro do conteúdo da extensão (o iframe).
- **`ler:jogadores`:** só o mestre usa (lista de jogadores para atribuir e nomes). Substitui o antigo registro `players/{uid}`.
- **Eventos:** não são necessários; o painel do mestre usa `RPG.estado.aoMudar` em tempo real. (`estado.jogadorSalvou` é opcional, para um aviso.)
- **Exclusividade de mesa:** vem de graça. Uma extensão só existe na mesa em que foi instalada. **Ocultar dos jogadores** = desligar `visivelJogadores` no cartão em Extensões.
- **Visibilidade:** publicar com `visivelJogadores = true` (a nativa é visível por padrão).

---

## 3. Modelo de dados (escopos)

A nativa usava 8 coleções. Na extensão, tudo cabe em 3 escopos:

| Nativa (coleção) | Extensão (escopo · documento) | Quem grava | Quem lê |
|---|---|---|---|
| `lore/{markId}`, `puzzles/{markId}` | `mestre` · `{ lore, puzzles }` | mestre | só o mestre |
| `assignments/{uid}`, `released/{uid}`, `puzzleStatus/{uid}` | `porJogador` · um documento por jogador | mestre | aquele jogador e o mestre |
| `notes/{uid}`, `puzzleResp/{uid}` | `doJogador` · um documento por jogador | o próprio jogador, sem aprovação | ele e o mestre |
| `players/{uid}` | (não existe: vem de `RPG.ler("jogadores")`) | – | – |
| `compartilhado` | não usado | – | – |

### 3.1 Escopo `mestre`

```ts
{
  versao: 1,
  lore:    { [markId: string]: Lore },     // gabarito da mecânica de cada Marca
  puzzles: { [markId: string]: Puzzle }    // banco de enigmas com gabarito
}

type Lore = {
  sold?: string;
  passivaNome: string; passiva: string;
  fardo: string;
  habilidadeNome: string; habilidade: string;
  circles: { circulo: string; gatilho: string; mudanca: string }[];   // "Os Nove Círculos"
  remocao: string;
};

type Puzzle = { titulo: string; ambiente?: string; etapas: PuzzleEtapa[] };
type PuzzleEtapa = {
  titulo: string; texto: string; pergunta: string;
  resposta: string;          // gabarito da pergunta (só o mestre vê)
  revelacao?: string;        // texto mostrado depois de vencer a mecânica
  mecanica?: Mecanica;       // ver seção 6
};
```

**Limite de 50 KB por documento.** Os arquivos completos têm ~97 KB (lore) + ~66 KB (enigmas), ~5,5 KB por Marca somando os dois. Não cabem os 23 inteiros. Regra da extensão:

- A importação aceita o arquivo inteiro, mas grava **só as Marcas atribuídas** (mais as que o mestre marcar como "manter") e informa quais ficaram de fora ("Importadas 6 de 23: só as Marcas em uso cabem no limite de 50 KB").
- Ao atribuir uma Marca cuja lore ou enigma ainda não está no escopo, o painel avisa "importe de novo o arquivo para trazer esta Marca".
- Se mesmo assim passar de 50 KB, recusar com mensagem clara (nunca gravar parcialmente sem avisar).
- Isso cobre ~7–9 Marcas em uso, o suficiente para uma mesa.

### 3.2 Escopo `porJogador` (o que o mestre entrega a cada jogador)

```ts
{
  markId: string | null,          // null = sem Marca
  atribuidaEm: number,            // Date.now(); também é o "ciclo" da Marca atual
  etapas: EtapaLiberada[],        // só as liberadas, ordenadas por idx, SEM gabarito
  vereditos: { [idx: string]: { estado: "aprovada" | "recusada"; nota: string } }
}

type EtapaLiberada = {
  idx: number; titulo: string; texto: string; pergunta: string;
  ambiente?: string;              // id da Marca (ou o `ambiente` do puzzle), escolhe a atmosfera
  revelacao?: string;
  mecanica?: MecanicaLiberada;    // a mecânica sem `solucao`, com `sal` e `hashes`
};
```

- **Nunca** copiar `resposta` nem `mecanica.solucao` para cá: este documento chega ao jogador.

### 3.3 Escopo `doJogador` (o que o jogador escreve)

```ts
{
  notas: {
    passiva: string; fardo: string; habilidade: string;
    niveis:  { id: string; nome: string; gatilho: string; mudanca: string }[];
    postits: { id: string; text: string }[];
  },
  enigmas: {
    markId: string,               // a Marca a que as respostas se referem
    atribuidaEm: number,          // o ciclo; se diferente do porJogador, as respostas são de uma Marca anterior
    respostas: { [idx: string]: string },     // texto da resposta de cada etapa
    decifradas: { [idx: string]: string }     // valor que venceu a mecânica (equivale ao antigo "ok{idx}")
  }
}
```

**Por que `markId` + `atribuidaEm` dentro de `enigmas`:** na nativa, trocar ou remover a Marca **apagava** `released`, `puzzleResp` e `puzzleStatus`. Na extensão o mestre **não pode gravar nem apagar** `doJogador` pela ponte (só no painel Dados). Então:

- Ao atribuir/trocar/remover, o mestre grava um `porJogador` novo (`etapas: []`, `vereditos: {}`, `atribuidaEm` novo).
- O jogador, ao ler o seu `doJogador`, **descarta** `enigmas` se `markId`/`atribuidaEm` não baterem com o `porJogador` atual (recomeça vazio na próxima gravação). O mestre também ignora respostas de ciclo antigo.
- As **anotações** (`notas`) não são apagadas ao trocar de Marca (igual à nativa).

---

## 4. Telas e comportamento

### 4.0 Entrada (decisão por papel)

- `RPG.eu === null` → mestre → **Painel do mestre**.
- Senão → jogador → **Visão do jogador** (a mesma no `sidebar`, no `ctrlk` e no `diario.jogador`).
- Títulos de cabeçalho (fora do frame, na tela cheia): "Marcas de Pacto" e o subtítulo "O Juramento de Cinzas" (no mestre, "O Juramento de Cinzas · você é o Mestre").
- Carregando: "Consultando os registros…".
- Jogador sem conta reivindicada: o mestre não consegue gravar o `porJogador` dele (a ponte devolve erro). O painel mostra o erro na linha do jogador ("Este jogador ainda não entrou com uma conta").

### 4.1 Visão do jogador

1. Assinar `RPG.estado.aoMudar("porJogador", fn)` e ler `RPG.estado.ler("doJogador")` **uma vez** (o estado local passa a ser a fonte das anotações, como na nativa).
2. **Sem Marca** (`markId` nulo ou desconhecido): painel centralizado com título "Aguarde" e "O Mestre ainda não lhe revelou uma Marca. Os pactos se fazem no tempo deles."
3. **Com Marca**, nesta ordem:
   - **Cabeçalho da Marca:** sigilo (140 px, cor `--m-blood-hi`), nome, em itálico "Você vendeu {sold}", e a build numa `tag`.
   - **Enigmas** (seção 5): só aparece se houver ao menos uma etapa liberada. Nada revela que existem enigmas antes disso.
   - **Status de gravação** alinhado à direita: "Gravando…", "Gravado ✓", ou em vermelho "Não foi possível gravar. Tentando de novo ao editar."
   - **Três campos** em grade de 3 colunas (1 no celular), cada um num painel com rótulo dourado e dica:
     - Passiva: "o efeito constante que você sente sempre ativo"
     - Fardo: "o que a Marca lhe cobra, o custo que você paga"
     - Habilidade: "o que você consegue invocar quando decide usar a Marca"
   - **Evolução da Marca:** botão "+ Novo nível"; texto "Cadastre os níveis que você acredita existirem e preencha o que acha que os dispara e o que muda. É a sua teoria."; vazio: "Nenhum nível cadastrado ainda."; tabela com colunas Nível (input "Nome / número"), Gatilho (textarea), O que muda (textarea) e um link "remover".
   - **Post-its:** botão "+ Novo post-it"; vazio: "Nada anotado ainda. Pistas, teorias, o que ouviu em jogo…"; grade 1/2/3 colunas; cada post-it é uma textarea transparente sobre papel amarelado, girado `((i*7) % 5) - 2` graus, com link "remover".
4. **Gravação das anotações e respostas (diferença obrigatória):** o broker limita o jogador a **10 gravações por minuto** em `doJogador`. A nativa gravava 700 ms após cada edição; aqui:
   - um **único** `RPG.estado.salvar("doJogador", tudo)` para notas + respostas + decifradas;
   - debounce de 1,5 s **e** intervalo mínimo de 6 s entre gravações (a última edição sempre é gravada no fim);
   - em `visibilitychange` (oculto) e `pagehide`, gravar imediatamente o que estiver pendente.
   - Erro de limite → status "Não foi possível gravar…" e nova tentativa na próxima janela.

### 4.2 Painel do mestre

Assinaturas: `RPG.ler("jogadores")`, `RPG.estado.ler("mestre")`, `RPG.estado.aoMudar("porJogador", fn)` e `RPG.estado.aoMudar("doJogador", fn)` (sem `jogador`: recebe `{ jogador, dados }` de cada um). Seções, nesta ordem, com espaçamento grande entre elas:

**a) Jogadores**
- Grade de 2 colunas; cada linha é um painel com o nome e um `select` "— sem Marca —" + as 23 Marcas.
- Vazio: "Nenhum jogador na mesa ainda." (a nativa dizia "Ninguém abriu o site ainda…", porque dependia do registro).
- Mudar o select: grava `porJogador` do jogador com `{ markId, atribuidaEm: Date.now(), etapas: [], vereditos: {} }` (ou `markId: null` para remover). Isso "limpa" o progresso (seção 3.3).

**b) Enigmas** (cabeçalho com botão fantasma "Importar enigmas" / "Fechar importação")
- Vazio: "Nenhuma Marca atribuída."
- Um `details` por jogador com Marca: "{nome} — {Marca}" e a tag "{n} liberada(s) · {m} resolvida(s)" (resolvidas = vereditos `aprovada`).
- Sem puzzle importado para a Marca: "Enigma desta Marca não importado. Use “Importar enigmas”."
- Com puzzle: título do puzzle em dourado e, para cada etapa (separadas por linha):
  - "{n}. {título}" e botão "Liberar etapa" (sólido) / "Recolher etapa" (fantasma);
  - texto em itálico apagado; "Pergunta:"; "Gabarito:"; "Mecânica:" com a tag do tipo e "solução: `…`";
  - se liberada: estado da mecânica (tag "Decifrada" ou "ainda não decifrada"), "Resposta do jogador:" (ou "(ainda não respondeu)"), botão "Aprovar", campo "Nota ao recusar (opcional)", botão "Recusar", link "limpar veredito" e tag "Aprovada"/"Recusada" quando houver.
- **Liberar/recolher:** recalcula a lista inteira de etapas liberadas (ordenada por `idx`), cada uma com `ambiente = puzzle.ambiente ?? markId` e a mecânica convertida por `liberarMecanica(mecanica, "{markId}:{idx}")`; grava o `porJogador` (preservando `markId`, `atribuidaEm`, `vereditos`).
- **Julgar:** grava `vereditos[idx] = { estado, nota }` (ou remove a chave ao limpar).
- Respostas exibidas são do `doJogador` **do ciclo atual** (seção 3.3). Exibir sempre como **texto** (escapar HTML): é conteúdo não confiável.

**c) Anotações dos Marcados**
- Vazio: "Nenhuma Marca atribuída."
- Um `details` por jogador com Marca: "{nome} — {Marca}". Sem `doJogador`: "Ainda não escreveu nada."
- Dentro: Passiva / Fardo / Habilidade (rótulos dourados em caixa alta; "(vazio)" quando vazio), tabela "Evolução segundo o jogador ({n})" (ou "(nenhum nível cadastrado)") e "Post-its ({n})" em grade de 2 colunas, sem rotação.

**d) As Vinte Marcas** (o título é esse mesmo, embora sejam 23; botão "Importar lore ({importadas}/23)" / "Fechar importação")
- Grade 2/4 colunas de cartões-botão: sigilo 64 px, nome, build em texto pequeno apagado e os donos em dourado ("Sem dono" apagado). Cartão aberto fica com borda dourada; clicar de novo fecha.
- Abaixo, o **gabarito** da Marca aberta: "{nome} — gabarito do Mestre", "Vendido: …" e, se houver lore: "Passiva — {passivaNome}", "Fardo", "Habilidade — {habilidadeNome}", tabela "Os Nove Círculos" (Círculo / Gatilho / O que muda) e "Remoção". Sem lore: "Lore desta Marca ainda não importada. Use “Importar lore”."

**e) Importar (lore e enigmas)**
- Painel com explicação, `input type=file` (`.json`) e `textarea` com o exemplo do formato `{ "eco-vazio": { … } }`, botão "Importar" e a mensagem do resultado.
- Valida: JSON válido, objeto não vazio, todos os ids existem em `MARCAS` (senão "Erro: ids inválidos: …").
- Mescla em `mestre.lore` ou `mestre.puzzles` aplicando a regra dos 50 KB (seção 3.1) e mostra "{n} Marca(s) importada(s)."
- Alternativa equivalente: colar o mesmo JSON em **Dados iniciais → Só do mestre** no criador (semeado ao publicar), respeitando o mesmo limite.

---

## 5. Enigmas do jogador (cena e etapas)

### 5.1 Cena (atmosfera)

- Envolve todas as etapas. O ambiente é o `ambiente` da primeira etapa que tiver um; desconhecido → `eco-vazio`.
- Camadas: `canvas` de partículas (atrás), vinheta (`box-shadow` interno escuro), conteúdo por cima. Fundo: a cor do ambiente a 6% sobre `#0a0807`.
- Cabeçalho "Enigmas" e botão fantasma "Som: desligado" / "Som: ligado" (`aria-pressed`).
- Efeitos de tela por `fx`: `pulso` (vinheta pulsa 1,8 s), `respira` (opacidade 6 s), `tremor` (etapas tremem 0,22 s), `treva` (escuro com um furo de luz de 190 px que segue o ponteiro), `glitch` (título da etapa com deslocamento ciano/magenta a cada 4 s).
- `prefers-reduced-motion`: sem partículas e sem animações.

**Partículas:** `qtd` grãos; nascem espalhados; caem (ou sobem, se `sobe`) com velocidade em `vel`, deriva horizontal aleatória ±0,3; tamanho em `tam`; opacidade `0,25 + (r/tamMax)*0,45`; forma `ponto` (círculo), `risco` (linha diagonal) ou `letra` (letra aleatória de "ABCDEFGHIJLMNOPRSTUVZ", serif); ao sair da tela renascem na borda. Redimensionar o canvas com `ResizeObserver`.

**Ambientes (não são spoiler):**

| id | cor | fx | partícula (cor, forma, sobe, tam, vel, qtd) | drone Hz |
|---|---|---|---|---|
| eco-vazio | #c02a2a | pulso | #ff5a3c ponto ↑ [1,3] [0.3,0.9] 55 | 55 |
| maos-que-lembram | #bfb8a8 | respira | #bfb8a8 ponto ↓ [1,3] [0.2,0.6] 70 | 62 |
| sangue-que-nega | #6b8f3a | respira | #7ea04a risco ↓ [4,8] [0.3,0.8] 40 | 70 |
| voz-perdida | #7aa6c9 | respira | #9cc3e0 ponto ↑ [1,2] [0.15,0.4] 45 | 82 |
| reflexo-partido | #9fd3e6 | glitch | #cdeaf5 risco ↓ [6,14] [0.4,1.1] 35 | 110 |
| juramento-cinzento | #8f8f8f | respira | #9a9a9a ponto ↓ [1,3] [0.2,0.5] 60 | 58 |
| segundo-pacto | #8a4fd6 | glitch | #a97bff ponto ↑ [1,2] [0.2,0.7] 48 | 65 |
| pagina-que-esquece | #d8cfbd | glitch | #d8cfbd letra ↓ [10,16] [0.2,0.5] 32 | 75 |
| sono-roubado | #9a8bff | respira | #c1b8ff ponto ↑ [1,3] [0.1,0.3] 50 | 49 |
| fome-eterna | #e08a2c | tremor | #ff9d3a ponto ↑ [1,3] [0.4,1.0] 55 | 52 |
| coracao-de-ferro | #cfe3f2 | respira | #e6f2fa ponto ↓ [1,3] [0.3,0.7] 55 | 73 |
| maos-manchadas | #b01818 | pulso | #b01818 risco ↓ [6,12] [0.8,1.8] 22 | 48 |
| tempo-perdido | #d9b45a | respira | #e8c978 ponto ↓ [1,2] [0.05,0.2] 60 | 80 |
| fera-interior | #d97a1e | tremor | #ffae4d ponto ↑ [1,3] [0.4,1.0] 50 | 45 |
| silencio-divino | #f0e2a8 | respira | #fff3c4 ponto ↑ [1,2] [0.05,0.25] 40 | 90 |
| sombra-viva | #6a6a80 | treva | #55556a ponto ↓ [1,3] [0.1,0.4] 40 | 42 |
| preco-justo | #e0b93c | respira | #f2cd5a ponto ↓ [1,3] [0.3,0.9] 45 | 68 |
| pele-de-vidro | #bfe6f0 | glitch | #dff4fa risco ↓ [4,10] [0.5,1.2] 40 | 120 |
| ultimo-suspiro | #b8c4c0 | treva | #c9d4d0 ponto ↑ [2,5] [0.1,0.35] 38 | 40 |
| coro-silencioso | #8fb0c0 | pulso | #a9c8d6 ponto ↑ [1,3] [0.15,0.5] 55 | 85 |
| fio-partido | #5fb6d9 | glitch | #ff8a3c risco ↓ [4,10] [0.4,1.0] 38 | 98 |
| dado-virado | #d9a441 | tremor | #f2cd5a ponto ↑ [2,5] [0.4,1.1] 45 | 77 |
| rosto-roubado | #b58fc9 | glitch | #d3b4e3 risco ↓ [5,12] [0.3,0.9] 34 | 92 |

**Som (Web Audio, sem arquivos):** criado só após um gesto. Com "Som: ligado", um drone senoidal na frequência do ambiente (ganho sobe a 0,03 em 2 s; desliga com rampa de 0,5 s). Efeitos: `acerto` (523, 659, 784 Hz em sequência de 0,12 s), `erro` (130 Hz dente-de-serra, 0,4 s), `clique` (900 Hz triangular, 0,05 s), `tique` (1800 Hz quadrada, 0,03 s). Envelope de cada tom: 0,0001 → vol em 10 ms → 0,0001 no fim. Só o **morse** toca mesmo com o som desligado (o som é o puzzle).

### 5.2 Etapa

- Painel com título (fonte de exibição, dourado, classe do glitch) e tag à direita: "Resolvido" se aprovada; "Decifrado" se tem mecânica e já está aberta.
- Texto da etapa em itálico.
- **Aberta** = sem mecânica, ou decifrada (há `decifradas[idx]`), ou vencida agora, ou aprovada.
- Fechada com mecânica: mostra a mecânica (seção 6). Ao vencer: grava `decifradas[idx] = valor` e abre.
- Aberta com mecânica e `revelacao`: bloco de revelação (borda esquerda na cor do ambiente, fundo a 12%, itálico).
- Aberta: a **pergunta** em negrito e uma textarea de resposta (somente leitura se aprovada), com status "Gravando…/Gravado ✓/Não foi possível gravar.".
- Recusada: em vermelho "O Mestre não aceitou essa resposta: {nota}. Reflita e tente de novo." (sem nota: termina com ponto).
- Etapa aprovada tem borda dourada; etapa aberta com mecânica tem borda na cor do ambiente (60%).

---

## 6. Mecânicas

### 6.1 Formatos (`Mecanica`, no gabarito do mestre)

Toda mecânica pode ter `dica?: string` e `solucao?: string` (alternativas separadas por `|`).

| tipo | campos | valor conferido |
|---|---|---|
| `cifra` | `modo: "cesar"\|"atbash"\|"espelho"\|"runico"`, `cifrado`, `deslocamento?` | a palavra digitada |
| `lanterna` | `palavras: { t, x, y }[]` (x, y em %) | a palavra digitada |
| `rastros` | `texto` (trechos marcados com `[[…]]`), `revelacoes: string[]` | a palavra digitada |
| `morse` | `codigo` (`.`, `-`, espaço entre letras, `/` entre palavras) | a palavra digitada |
| `fragmentos` | `pecas: string[]` | a ordem dos índices originais, ex.: `"2,0,1"` |
| `relogio` | – | `"HH:MM"` (hora 1–12 com dois dígitos) |
| `runas` | `aneis: string[]` (cada anel é uma string de símbolos) | os símbolos visíveis concatenados |
| `escolha` | `rodadas: { fala, opcoes: string[] }[]` | os índices escolhidos até agora, ex.: `"1,0,2"` (confere a cada escolha, então a `solucao` lista também os prefixos: `"1\|1,0\|1,0,2"`) |
| `espera` | `modo: "segurar"\|"quietude"`, `segundos`, `rotulo?`, `tentacoes?: string[]` | sempre `"ok"` (sem hash) |

### 6.2 Hash (copiar exatamente; precisa bater com os dados já criados)

```text
normalizar(s) = s.normalize("NFD"), remove diacríticos (U+0300–U+036F), minúsculas, remove tudo que não é [a-z0-9,:]
cyrb53(str):  h1 = 0xdeadbeef, h2 = 0x41c6ce57
              para cada caractere ch:  h1 = imul(h1 ^ ch, 2654435761);  h2 = imul(h2 ^ ch, 1597334677)
              h1 = imul(h1 ^ (h1 >>> 16), 2246822507);  h1 ^= imul(h2 ^ (h2 >>> 13), 3266489909)
              h2 = imul(h2 ^ (h2 >>> 16), 2246822507);  h2 ^= imul(h1 ^ (h1 >>> 13), 3266489909)
              resultado = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
selar(valor, sal) = cyrb53(sal + "|" + normalizar(valor))
liberarMecanica(m, sal) = m sem `solucao`, + `sal`, + `hashes = solucao.split("|").map(s => selar(s, sal))`
confere(m, valor) = m.sal && m.hashes && m.hashes.includes(selar(valor, m.sal))
sal = "{markId}:{idx}"
```

- `liberarMecanica` roda **no navegador do mestre**, ao liberar. O HTML pode conter essas funções: elas não revelam nada.
- Não é criptografia: só impede que a solução apareça em texto puro. Isso é aceito (como na nativa).
- Não usar arrays aninhados nos dados (herança do Firestore; manter o formato para os JSONs servirem sem conversão).

### 6.3 Campo "A palavra é…" (cifra, lanterna, rastros, morse)

- Input + botão "Selar". Vazio não faz nada.
- Certo: som de acerto e conclui com o valor digitado (sem espaços nas pontas).
- Errado: som de erro, tremida de 0,45 s, "Nada acontece. O selo não cede." em vermelho; a partir do 2º erro, "Sussurro: {dica}".

### 6.4 Cada mecânica

- **Cifra**
  - `cesar`: o texto é mostrado deslocado de −n; controle deslizante 0–25 com "Gire o disco de bronze: {n} casa(s)" e a linha `ABC… → (deslocado)`; clique a cada mudança.
  - `atbash`: botão "Inverter o alfabeto"/"Voltar o alfabeto" alterna entre o cifrado e o invertido; linha `A…Z ↔ Z…A`.
  - `espelho`: texto espelhado (`scaleX(-1)`, transição de 0,6 s); botão "Virar o espelho"/"Devolver ao vidro".
  - `runico`: texto em runas grandes; `details` "Tábua de runas" com `ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟᚪᚫ` ↔ A–Z.
  - Texto cifrado em monoespaçada, fundo preto translúcido, borda tracejada.
- **Lanterna:** área de 15 rem, escura, cursor oculto; palavras posicionadas em % com brilho na cor do ambiente; um gradiente radial de 95 px segue o ponteiro (começa fora da área). Legenda "Passe a luz pela escuridão. Nem tudo que brilha é pista." e link "acender tudo (acessibilidade)"/"apagar a tocha".
- **Rastros:** o texto com os trechos `[[…]]` virando botões sublinhados pontilhados que brilham a cada 3,2 s; tocar revela a `revelacoes[k]` correspondente numa lista em itálico ("“…”") e deixa o trecho com sublinhado sólido na cor do ambiente. Legenda "Algumas palavras guardam mais do que dizem. Toque nelas."
- **Morse:** lâmpada redonda que acende (brilho na cor do ambiente) e botão "Ouvir o sinal"/"Transmitindo…" (desabilitado enquanto toca). Unidade 160 ms; ponto = 1 u, traço = 3 u, pausa entre símbolos 1 u, espaço +2 u, `/` +4 u; tom de 620 Hz a cada símbolo; a linha abaixo vai escrevendo os símbolos (vazia: "· · ·"). `details` "Código dos antigos" com a tabela A–Z.
- **Fragmentos:** lista das peças na ordem original com botões ▲/▼ (desabilitados nas pontas) que trocam vizinhos; botão "Selar a ordem". Erro: tremida, "As peças não se encaixam assim."; dica a partir do 2º erro.
- **Relógio:** mostrador SVG (aro dourado, 12 marcas, ponteiro das horas osso, minutos vermelho, centro dourado); começa em 6:30; Hora −/+ (1–12, circular), Minuto −/+ de 5 em 5; tique a cada ajuste; botão "Parar o tempo". Erro: "O tempo se recusa a parar nesse instante."; dica a partir do 2º erro.
- **Runas (cadeado):** um anel por string, cada um com ▲, o símbolo atual (caixa dourada) e ▼; a cada giro confere; ao acertar, o cadeado brilha, mostra "O fecho cede." e conclui 0,9 s depois. Texto inicial "Gire os anéis até que algo ceda." A dica aparece sempre.
- **Escolha (diálogo):** histórico das rodadas já feitas ("*fala* — opção" em dourado), a fala atual em itálico e as opções como botões. Cada escolha confere o prefixo; se errar, tremida, zera tudo e "Algo se partiu na conversa. Tudo recomeça."; ao completar todas as rodadas, conclui. A dica aparece sempre.
- **Espera**
  - `segurar`: botão redondo (9 rem) "Segure" (ou `rotulo`) que, pressionado (ponteiro, Espaço ou Enter), enche por `segundos`; soltar zera, toca erro e conta "Você cedeu {n}×; a contagem recomeça."; frases de `tentacoes` aparecem em vermelho conforme o progresso; barra de progresso; legenda "Mantenha pressionado por {s}s.".
  - `quietude`: botão "Começar a vigília" (ou `rotulo`); durante: "Não se mova. Não toque em nada."; qualquer `pointermove` (≥ 3 px), `keydown`, `wheel` ou `touchmove` depois de 800 ms de folga zera e conta "Você se mexeu {n}×. O tempo recomeça."; tique a cada segundo; legenda "Fique imóvel por {s}s — mouse, teclado e toque parados.".

---

## 7. Visual

### 7.1 Tokens

```css
--m-bg: #0b0908;   --m-panel: #14100e;  --m-panel2: #1b1512;  --m-line: #33291f;
--m-bone: #d8cfbd; --m-dim: #8f8573;    --m-blood: #9b1c1c;   --m-blood-hi: #c02a2a;  --m-gold: #b08d3c;
```

- **Fundo:** `radial-gradient(ellipse at 50% -10%, #2a0f0c 0%, transparent 55%)` sobre `--m-bg`; texto `--m-bone`, 1,08 rem.
- **Fontes:** a nativa usa Cinzel (títulos, botões, tags, cabeçalhos de tabela; `letter-spacing` 0,04 em) e EB Garamond (texto). O iframe **não tem rede** (`font-src data:`), então: usar a pilha `"Cinzel", "Trajan Pro", "Cormorant SC", Georgia, serif` para títulos e `"EB Garamond", Garamond, Georgia, serif` para texto. Só embutir as fontes em base64 se o HTML continuar bem abaixo de 150 KB (o subset latino de cada uma pesa dezenas de KB).
- **Painel:** fundo `--m-panel`, borda 1 px `--m-line`, raio 4 px.
- **Tag:** borda e texto dourados, Cinzel 0,7 rem, caixa alta, `letter-spacing` 0,12 em.
- **Campos:** fundo `--m-bg`, borda `--m-line`, raio 3 px; foco com borda e anel `--m-blood-hi`; textarea redimensionável, mínimo 6 rem.
- **Botão:** fundo `--m-blood`, texto `#f3e9d6`, borda `--m-blood-hi`, Cinzel 0,8 rem; hover `--m-blood-hi`. **Fantasma:** transparente, borda `--m-line`; hover dourado.
- **Post-it:** `#e4d7b3`, texto `#2a2118`, sombra `0 6px 14px rgba(0,0,0,.55)`, girado por `--rot`.
- **Tabelas:** bordas `--m-line`; cabeçalho dourado em Cinzel 0,8 rem.
- `h2` e `.gold` em dourado; `.dim` em `--m-dim`.
- O frame (raio 16 px, padding 16–24 px) ocupa o corpo do iframe; o `body` do iframe deve sobrescrever o fundo e a fonte padrão injetados pelo app.

### 7.2 Sigilo (SVG determinístico, copiar exatamente)

Entrada: `index` = posição da Marca na lista `MARCAS` (0–22). `viewBox 0 0 100 100`, cor `currentColor`, traço 1,2, pontas redondas.

```text
rng(seed): s = (seed + 1) * 2654435761; a cada chamada:
           s = (s ^ (s << 13)) >>> 0;  s = (s ^ (s >>> 17)) >>> 0;  s = (s ^ (s << 5)) >>> 0;  devolve (s % 10000) / 10000
r = rng(index*97 + 13)            (as chamadas a r() acontecem nesta ordem:)
rays   = 5 + (index % 8)
tip    = index % 3                 (0 círculo, 1 losango, 2 triângulo)
inner  = 3 + floor(r()*5)
rot    = r()*360
rOuter = 44
rRing  = 30 + floor(r()*6)
rCore  = 8 + floor(r()*6)
broken = floor(r()*rays)           (um raio "partido", mais curto)
ringGap = 0.6 + r()*1.2
pt(ang, rad) = (50 + cos(ang)*rad, 50 + sin(ang)*rad); números com 2 casas
```

- Grupo girado `rot` em torno de (50, 50).
- Círculo `rRing` sem preenchimento, tracejado `"{ringGap*6} {ringGap*2}"`; círculo `rOuter` traço 0,5, opacidade 0,5.
- Polígono de `inner` lados em raio `rRing − 6`, começando em −90°, traço 0,9.
- Para cada raio `i` (ângulo `i/rays * 2π`): comprimento `len = rOuter − 14` se `i == broken`, senão `rOuter − 4`; linha de `pt(a, rRing)` a `pt(a, len)`; ponta:
  - círculo r=2 em `pt(a, len+3)`;
  - losango `[pt(a,len+6), pt(a+0.12,len+2), pt(a,len−2), pt(a−0.12,len+2)]`;
  - triângulo `[pt(a,len+6), pt(a+0.14,len), pt(a−0.14,len)]`.
- Círculo `rCore` sem preenchimento e ponto central r=2,5.

### 7.3 Dados públicos embutidos no HTML

A lista `MARCAS` (23 itens: `id`, `name`, `sold`, `build`) de `src/lib/marcas-data.ts`, **na mesma ordem** (a ordem define o sigilo), e a tabela de ambientes da seção 5.1. Ambas são visíveis ao jogador por design; nada de lore ou enigma no HTML.

---

## 8. Segurança e limites (o que conferir)

- **Nada secreto no HTML.** O HTML é visível a qualquer jogador que abra a extensão. Lore, gabaritos, `resposta` e `solucao` só no escopo `mestre`.
- **O `porJogador` só leva o que o jogador pode ver** (etapas liberadas sem gabarito, hashes, vereditos).
- **O jogador nunca lê o de outro:** garantido pelas regras do Firestore (`para_{uid}`, `de_{uid}`). A extensão não precisa (nem consegue) fazer isso.
- **Conteúdo do jogador é não confiável:** o painel do mestre renderiza com `textContent`, nunca `innerHTML`.
- **Sem `alert`, `confirm`, `prompt`** (bloqueados no iframe): confirmações e erros na própria página.
- **Limites:** HTML ≤ 150 KB; cada documento de escopo ≤ 50.000 caracteres; jogador ≤ 10 gravações/min; resposta da ponte em até 15 s.
- **Ensaio no criador:** usar "Ver como: mestre | jogador…" com o estado em memória, semear o escopo `mestre` com uma ou duas Marcas do JSON e conferir: atribuir, liberar etapa, jogar a mecânica como jogador, responder, aprovar/recusar como mestre.

---

## 9. Diferenças em relação à nativa (aceitas)

| Ponto | Nativa | Extensão |
|---|---|---|
| Lista de jogadores | quem abriu as Marcas (`players`) | todos os jogadores da mesa (`ler:jogadores`); quem não tem conta não recebe Marca |
| Gabarito | 23 Marcas inteiras | só as que cabem em 50 KB (as em uso) |
| Trocar de Marca | apaga respostas e vereditos | começa ciclo novo; respostas antigas são ignoradas (e podem ser limpas no painel Dados) |
| Gravação | 700 ms após editar | debounce + no máximo 10/min, um documento só |
| Fontes | Cinzel e EB Garamond do Google | pilhas locais (sem rede) ou embutidas |
| Tema | só no conteúdo | só no iframe (igual na prática) |
| Fechar a aba com edição pendente | aviso do navegador | gravação em `pagehide`/`visibilitychange` |
| Diário | seção na página, altura livre | encaixe inline com altura fixa (até 900 px, com rolagem) |

---

## 10. Como pedir ao criador

1. Extensões → Criar. Colar as seções 1 a 8 deste documento como pedido (se a resposta vier cortada, pedir em partes: primeiro o painel do mestre e a visão do jogador sem mecânicas; depois as mecânicas uma a uma, sempre devolvendo o HTML completo e enxuto).
2. Conferir o manifesto (seção 2) na aba "Onde aparece", incluindo "Onde guarda dados".
3. Em **Dados iniciais → Só do mestre**, colar `{ "versao": 1, "lore": {…}, "puzzles": {…} }` só com as Marcas da mesa (ou importar depois, pelo painel da extensão).
4. Ensaiar (seção 8), salvar e **Publicar na mesa**, aprovando `ler:jogadores` e os três escopos.
5. Quando a extensão estiver validada, desligar ou ocultar a nativa na mesa original para não haver duas.

## Relações

[base: marcas-de-pacto](../base-conhecimento/features/marcas-de-pacto.md), [base: extensoes](../base-conhecimento/features/extensoes.md), [fluxo: criar-extensao](../base-conhecimento/fluxos/criar-extensao.md), change `openspec/changes/extensoes-estado-por-escopo/`.
