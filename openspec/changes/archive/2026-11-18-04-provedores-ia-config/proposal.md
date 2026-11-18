## Why

O mestre deve poder escolher o modelo de IA e usar a própria chave. O sistema precisa ser agnóstico de provedor: adicionar um novo modelo deve ser tão simples quanto adicionar uma extensão (um arquivo). Esta change entrega essa camada e a tela de configuração, usável e testável antes de existir qualquer gerador de mapa.

## What Changes

- Interfaces `ProvedorImagem` e `ProvedorLlm` com capacidades declaradas (alfa nativo, imagens de referência, inpainting, seed, tamanhos).
- Registro de provedores (Registry) com adaptadores (Adapter); adicionar um provedor = um arquivo mais uma linha no registro.
- Tela "IA" nas configurações da conta do mestre, gerada a partir dos `campos` de cada provedor, com botão "Testar conexão".
- Chaves por mestre, cifradas no servidor, nunca legíveis pelo cliente.
- Rota de servidor que executa chamadas ao provedor usando a chave do mestre dono da mesa.
- Teto de gasto por mesa e estimativa antes de ações em lote.
- Degradação por capacidade (por exemplo, remoção de fundo quando não há alfa nativo).
- **Provedor de imagem e provedor de LLM são independentes**: o mestre escolhe cada um separadamente e pode combinar marcas, por exemplo Gemini (Nano Banana) para imagens e Claude Sonnet como LLM. Cada provedor usa a credencial do seu fabricante; quando os dois são do mesmo fabricante, uma única chave serve aos dois.
- Provedores iniciais: **Google Gemini** para imagem (família "Nano Banana") e para LLM, com a mesma chave Google atendendo os dois quando o mestre escolhe Google para ambos. Também entra um adaptador LLM da **Anthropic (Claude)**, para validar a combinação de marcas desde o início. O spike de comparação foi adiado; outros provedores entram depois como extensões.
- Remoção de fundo local (chroma key) como primeira implementação do `RemovedorFundo`, pois o Gemini não entrega PNG com transparência nativa (a confirmar na implementação).

## Capabilities

### New Capabilities
- `provedores-ia`: contratos, registro, capacidades e degradação.
- `configuracao-ia-mestre`: tela de configuração, teste de conexão e escolha do provedor ativo.
- `segredos-por-mestre`: armazenamento cifrado de chaves e execução no servidor.
- `limites-de-gasto`: tetos e estimativas por mesa.

### Modified Capabilities

## Impact

- Novos: `src/lib/mapas-ia/provedores/*`, `registro.ts`, `src/app/api/ia/*`, tela em configurações da conta.
- `firestore.rules`: `usuarios/{uid}/segredos` sem leitura pelo cliente.
- Depende de `02-infra-storage-servidor`. O spike de provedores está adiado (ver `openspec/adiadas/`).
- Nova variável de ambiente para a chave de cifragem.
