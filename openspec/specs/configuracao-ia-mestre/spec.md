# configuracao-ia-mestre

## Purpose

Ver change arquivada 04-provedores-ia-config.

## Requirements

### Requirement: Tela de configuração de IA
O mestre SHALL ter uma tela para escolher o provedor de imagem e o de LLM e preencher os campos de cada um.

#### Scenario: Configurar provedor
- **WHEN** o mestre escolhe um provedor e informa a chave
- **THEN** a configuração é salva e o provedor fica marcado como "configurado"

### Requirement: Teste de conexão
A tela SHALL oferecer "Testar conexão" que faz uma chamada mínima ao provedor.

#### Scenario: Chave inválida
- **WHEN** o teste é executado com chave inválida
- **THEN** a tela mostra o erro sem revelar a chave

#### Scenario: Chave válida
- **WHEN** o teste é executado com chave válida
- **THEN** a tela mostra sucesso e as capacidades do provedor

### Requirement: Provedor ativo por mestre
Cada mestre SHALL ter um provedor ativo de imagem e um de LLM, usados em todas as suas mesas.

#### Scenario: Trocar provedor
- **WHEN** o mestre troca o provedor ativo
- **THEN** as próximas gerações usam o novo provedor e o conteúdo já gerado permanece

### Requirement: Escolha independente de imagem e LLM
O mestre SHALL escolher o provedor de imagem e o provedor de LLM separadamente, podendo combinar fabricantes diferentes.

#### Scenario: Combinação mista
- **WHEN** o mestre escolhe Google Gemini para imagem e Claude Sonnet para LLM
- **THEN** as gerações de imagem usam a credencial Google e as conversas do agente usam a credencial Anthropic

#### Scenario: Trocar só o LLM
- **WHEN** o mestre troca o LLM de Anthropic para Google
- **THEN** o provedor de imagem permanece o mesmo e nenhum conteúdo gerado é perdido

### Requirement: Credenciais por fabricante
O sistema SHALL guardar uma credencial por fabricante, compartilhada pelos provedores do mesmo fabricante.

#### Scenario: Mesmo fabricante
- **WHEN** o mestre escolhe Google para imagem e para LLM
- **THEN** é solicitada uma única chave Google

#### Scenario: Fabricantes diferentes
- **WHEN** o mestre escolhe Google para imagem e Anthropic para LLM
- **THEN** são solicitadas duas chaves e cada uma só é usada pelo respectivo provedor

### Requirement: Aviso de capacidade do LLM
Quando uma função exige uma capacidade que o LLM ativo não declara, a interface SHALL avisar e oferecer alternativa.

#### Scenario: LLM sem visão
- **WHEN** o LLM ativo não tem visão e o mestre pede a análise de um tema
- **THEN** a tela avisa e oferece o preenchimento manual do perfil
