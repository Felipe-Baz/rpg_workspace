# rotas-servidor-autenticadas

## Purpose

Ver change arquivada 02-infra-storage-servidor.

## Requirements

### Requirement: Rotas exigem autenticação
Toda rota em `/api` (exceto `/api/saude`) SHALL rejeitar requisições sem ID token válido do Firebase.

#### Scenario: Sem token
- **WHEN** uma requisição chega sem cabeçalho de autorização
- **THEN** a rota responde 401

#### Scenario: Token inválido
- **WHEN** o token está expirado ou adulterado
- **THEN** a rota responde 401

### Requirement: Verificação de papel de mestre
Rotas de ação do mestre SHALL responder 403 quando o usuário não é o dono da mesa.

#### Scenario: Jogador chama rota de mestre
- **WHEN** um membro não dono chama uma rota que exige mestre
- **THEN** a rota responde 403

### Requirement: Diagnóstico de configuração
A rota `/api/saude` SHALL informar se Storage e credenciais admin estão configurados, sem expor valores.

#### Scenario: Ambiente configurado
- **WHEN** `/api/saude` é chamada
- **THEN** retorna `{ storage: true, admin: true }` e nenhum segredo
