# rpg_workspace


## Storage e rotas de servidor

- Requer o plano **Blaze** do Firebase (configure um alerta de orçamento) e o **Storage** habilitado.
- Publique as regras: `firebase deploy --only storage` (arquivo `storage.rules`) e `firestore.rules`.
- Variáveis (veja `.env.local.example`): `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (cliente) e
  `FIREBASE_ADMIN_CREDENTIALS` (JSON da conta de serviço em uma linha; só servidor, nunca `NEXT_PUBLIC_`).
- `GET /api/saude` informa `{ storage, admin }` sem expor valores.
- Sem Storage configurado, mapas continuam usando data URL (~900 KB). Mapas antigos seguem funcionando.
- Limite conhecido: a leitura no Storage é aberta a membros da mesa; quem obtiver a URL de um mapa não liberado consegue abri-la (os nomes são aleatórios).
