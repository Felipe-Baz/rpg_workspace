## Context

Não há camada de IA. Cada mestre usa a própria chave. O sistema deve aceitar novos provedores sem mexer na UI nem no núcleo.

## Goals / Non-Goals

**Goals:**
- Núcleo isolado do provedor por interfaces.
- Adicionar provedor = um arquivo + uma linha.
- Chaves nunca expostas ao cliente.

**Non-Goals:**
- Gerar assets ou mapas (changes seguintes).
- Cobrança ou chaves compartilhadas.

## Decisions

- **Padrões**: Strategy (provedor), Registry (`registro.ts`), Adapter (cada provedor traduz a API externa para a interface).
- **Interfaces**:
  - `ProvedorImagem { id, nome, campos[], capacidades, gerar(), editar?() }`
  - `ProvedorLlm { id, nome, campos[], conversar() }` com schema de ferramentas neutro.
- **Registro explícito** em `registro.ts`, pois o bundler do Next não faz auto-descoberta de pastas de forma portável. Um script opcional pode gerar o registro a partir da pasta.
- **UI gerada** por `campos` (tipo, rótulo, segredo ou não). Provedor novo não exige código de UI.
- **Segredos**: `usuarios/{uid}/segredos/{provedorId}`, cifrados com AES-GCM no servidor, chave mestra em variável de ambiente. Regra do Firestore nega leitura pelo cliente; a UI mostra "configurada" e os 4 últimos caracteres via rota de servidor.
- **Execução**: `POST /api/ia/gerar` valida token, exige mestre da mesa, carrega e decifra a chave do dono, chama o provedor e devolve o resultado. Nunca registra a chave em log.
- **Degradação**: o orquestrador consulta `capacidades` e compõe etapas (`RemovedorFundo` como outro ponto de extensão).
- **Suíte de contrato**: todo provedor passa pelos mesmos testes com HTTP simulado.
- **Limites de gasto**: contador por mesa e período em `mesas/{id}/uso`, com teto configurável; ações em lote exigem estimativa e confirmação.

- **Seleção independente**: a configuração do mestre guarda `provedorImagemAtivo` e `provedorLlmAtivo` separados; nenhum código assume que são do mesmo fabricante. Cada interface é consumida só por quem precisa dela (o gerador de assets usa `ProvedorImagem`; o agente e a análise de tema usam `ProvedorLlm`).
- **Credencial por fabricante**: cada provedor declara um `credencialId` (por exemplo `google`, `anthropic`). Segredos ficam em `usuarios/{uid}/segredos/{credencialId}`. Provedores do mesmo fabricante compartilham a credencial; fabricantes diferentes exigem chaves diferentes, todas na mão do mestre.
- **Tool use neutro**: o schema de ferramentas do agente é independente de fabricante; cada `ProvedorLlm` traduz para o formato do seu fornecedor (function calling do Gemini, tool use da Anthropic) e devolve chamadas no formato neutro.
- **Visão**: `ProvedorLlm` declara `capacidades.visao`. A análise de tema (change 05) exige um LLM com visão; se o ativo não tem, a UI avisa e oferece o preenchimento manual.
- **Provedor inicial: Google Gemini.** Dois adaptadores (`google-imagem` e `google-llm`) compartilham a credencial `google`. Um terceiro adaptador, `anthropic-llm` (Claude Sonnet, modelo configurável), usa a credencial `anthropic`. A combinação inicial recomendada é imagem Google + LLM Anthropic, mas qualquer combinação é válida. O campo `modelo` é configurável pelo mestre (com valor padrão sugerido), pois nomes de modelo mudam; o ID exato é confirmado na documentação oficial durante a implementação.
- **Capacidades assumidas para o Gemini (verificar na implementação):** aceita várias imagens de referência; edição por instrução em linguagem natural, sem máscara (então `inpainting` é declarado como "por instrução", não por máscara); sem `seed` garantido; sem alfa nativo.
- **Sem alfa nativo, a degradação é o caminho principal.** O pipeline pede o sprite sobre fundo chapado de cor improvável (por exemplo magenta) e o `RemovedorFundoChroma` remove a cor localmente, sem custo extra de API, com limpeza de bordas. `RemovedorFundo` continua sendo ponto de extensão (por exemplo, trocar por um modelo de remoção ou por um provedor com alfa nativo).
- **Sem spike:** a qualidade será validada de forma incremental, com a chave do próprio desenvolvedor, na tarefa de verificação 6.4 e na change 06.

## Risks / Trade-offs

- Qualidade e consistência de estilo do Gemini não foram medidas contra outros modelos → adaptadores isolados permitem trocar ou adicionar provedores sem mexer no núcleo.
- Recorte por chroma key pode deixar halo nas bordas ou apagar tons parecidos com a cor-chave → cor-chave escolhida por asset e limpeza de bordas; opção de regerar.

- Perda da chave mestra de cifragem invalida as chaves salvas → procedimento de rotação documentado e reentrada de chaves.
- Provedores mudam APIs → isolado nos adaptadores.
- Custo percebido como surpresa → estimativa e teto padrão baixo.
