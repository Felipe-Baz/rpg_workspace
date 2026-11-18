## ADDED Requirements

### Requirement: Chaves cifradas e ilegíveis pelo cliente
As chaves SHALL ser armazenadas cifradas e SHALL NOT ser retornadas ao cliente em nenhuma rota.

#### Scenario: Leitura direta negada
- **WHEN** o cliente tenta ler `usuarios/{uid}/segredos/*` pelo Firestore
- **THEN** a regra nega o acesso

#### Scenario: Exibição mascarada
- **WHEN** a UI consulta o estado da chave
- **THEN** recebe apenas "configurada" e os 4 últimos caracteres

### Requirement: Uso da chave do mestre dono
Chamadas de IA SHALL usar a chave do mestre dono da mesa, nunca a de outro usuário.

#### Scenario: Jogador tenta gerar
- **WHEN** um jogador chama a rota de geração
- **THEN** a rota responde 403 e nenhuma chave é usada

### Requirement: Sem vazamento em logs
A chave SHALL NOT aparecer em logs, mensagens de erro ou respostas.

#### Scenario: Erro do provedor
- **WHEN** o provedor retorna erro de autenticação
- **THEN** a mensagem devolvida ao cliente não contém a chave
