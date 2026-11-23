# biblioteca-de-assets

## Purpose

Ver change arquivada 06-biblioteca-assets-ia.

## Requirements

### Requirement: Biblioteca por mesa
A mesa SHALL ter uma biblioteca de assets com tipo, tags, tema, perspectiva e origem.

#### Scenario: Buscar por tag
- **WHEN** o mestre busca "árvore" na paleta do editor
- **THEN** aparecem os assets com essa tag compatíveis com a perspectiva da cena

### Requirement: Reutilização antes de gerar
Antes de gerar, o sistema SHALL oferecer assets existentes que correspondam à descrição.

#### Scenario: Asset já existe
- **WHEN** o mestre pede "carvalho" e já há um asset com essa tag no mesmo tema
- **THEN** o sistema oferece reutilizá-lo ou gerar uma variação

### Requirement: Exclusão segura
Um asset em uso por alguma cena SHALL NOT ser excluído sem substituição.

#### Scenario: Excluir asset em uso
- **WHEN** o mestre tenta excluir um asset usado em 2 cenas
- **THEN** o sistema lista as cenas e pede um substituto ou cancela

### Requirement: Biblioteca pública de assets de IA
Todo asset gerado por IA SHALL ter uma cópia na biblioteca pública, legível por qualquer usuário logado e gravável apenas pelo servidor; a cópia SHALL NOT conter tema, prompt, mesa ou usuário. Assets enviados como PNG SHALL permanecer privados da mesa.

#### Scenario: Asset gerado fica público
- **WHEN** um job de geração conclui um asset
- **THEN** o asset aparece na aba "Pública (IA)" de qualquer mesa, sem o prompt nem o tema do mestre

#### Scenario: PNG enviado é privado
- **WHEN** o mestre envia um PNG para a biblioteca
- **THEN** ele só é visível na biblioteca daquela mesa e nunca na pública

#### Scenario: Usar asset público
- **WHEN** o mestre escolhe um asset público
- **THEN** ele é trazido para a biblioteca da mesa (mesmo id e arquivo) e pode ser carimbado na cena; excluí-lo da mesa não apaga o arquivo público
