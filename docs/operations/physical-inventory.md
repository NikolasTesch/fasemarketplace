# Estoque físico local — SPEC de 27/10/2026

Implementado e homologado somente na stack Docker local em 27/10/2026. A API NestJS persiste o ledger no schema `business`; saldos são derivados dos movimentos. A interface React tem estoque físico, lançamentos, histórico e configurações. O modo local começa separado por canal. A integração com marketplaces, Neon, Preview e Production não foi alterada.

## Dados locais de abertura

Foi criada uma abertura sintética para as seis variantes ativas, em `PHYSICAL_RESERVE`, na ordem crescente de SKU. O mínimo inicial é 20% arredondado para cima, por SKU. Esses valores servem para homologação e devem ser substituídos por uma contagem real antes de operação de negócio.

| SKU | Reserva física | Mínimo |
| --- | ---: | ---: |
| CAM-AZ-M | 25 | 5 |
| CAM-PRETA-G | 32 | 7 |
| CAM-PRETA-M | 39 | 8 |
| GAR-SPORT-750 | 46 | 10 |
| MEIA-BR-39 | 53 | 11 |
| MEIA-PR-39 | 60 | 12 |

## Subir a stack

O arquivo `.env.catalog-local` é privado e ignorado pelo Git. O flag `INVENTORY_ENABLED=true` e a flag de UI `VITE_INVENTORY_ENABLED=true` são somente locais. Para iniciar ou reconstruir a stack, na raiz do repositório:

```powershell
docker compose --env-file .env.catalog-local -p fasemarketplace-catalog-local -f compose.yaml -f compose.business.yaml -f compose.catalog.yaml up -d --build --wait --wait-timeout 180 api web
```

Confirme a API em `http://127.0.0.1:4874/health/ready` e abra `http://127.0.0.1:4873/`. A sessão requer autenticação local. O banco é o PostgreSQL 17 da stack `fasemarketplace-catalog-local`; não reutilize este comando com arquivos Compose híbrido ou Production.

## Próximas migrations locais

Antes de cada migration, gere um arquivo de backup com nome novo e restaure-o em uma base de quarentena, seguindo [Prisma business — backup e recuperação](business-persistence.md) e [backup de acesso](access-backup.md). A cópia desta entrega foi criada antes da migration, descriptografada e restaurada em base de quarentena nova; não é uma cópia externa.

Use somente a stack local e o perfil de manutenção. As credenciais vêm dos arquivos privados já preparados, nunca as imprima:

```powershell
$compose = @('--env-file', '.env.catalog-local', '--env-file', '.env.catalog-backup-key', '-p', 'fasemarketplace-catalog-local', '-f', 'compose.yaml', '-f', 'compose.business.yaml', '-f', 'compose.catalog.yaml', '--profile', 'business-maintenance')
docker compose @compose run --rm business-maintenance npm run business:check
docker compose @compose run --rm business-maintenance npm run business:migrate
docker compose @compose run --rm api npm run inventory:seed-local
```

Não rode a seed novamente: é uma carga única, não um reconciliador de saldo. A rotina recusa qualquer destino que não seja a base Docker local `fasemarketplace`, exige os flags locais e a role de runtime `fm_business_runtime`, e recusa uma segunda abertura. Migrations são explícitas e não executam ao iniciar API/worker.

Após a migration/seed, confira `/inventory/stock`, `/inventory/movements` e `/inventory/settings` por uma sessão local autenticada. Recarregue a aplicação e confirme persistência. A suíte automatizada `apps/backend/test/inventory.integration.mjs` cria bancos sintéticos e não deve ser apontada para o banco da aplicação.

## Evidências e limites

- Backup local pré-migration: `backups/catalog/pre-inventory-20261027.fmbackup`; SHA-256 `d25ccf7e63a80fd6731bf4d5135e62a9548a3a79de543a14b8c1081468660d5b`. Restore isolado em `fm_auth_restore_41b4f2e6abaa3d8117ed828a`, PostgreSQL 17, conteúdo verificado. A cópia contém estado anterior à migration.
- A migration `20261027125036_inventory` foi aplicada explicitamente após o preflight. O estado local contém três migrations business concluídas, seis movimentos de abertura e seis políticas de mínimo. Catálogo (3 produtos / 6 variantes) e 5 identidades locais foram preservados.
- `npm test` executado na imagem de validação: 8 testes de telemetria, 60 testes backend regulares e 17 testes de transporte aprovados. Lint, typecheck e build aprovados.
- Integração da API e banco sintético: 8/8 testes em PostgreSQL 17 e 8/8 em PostgreSQL 18, incluindo autorização, idempotência, concorrência, transições de modo, mínimos, seed única e append-only.
- Contrato visual Playwright: `scripts/verify-workspace-ui.mjs` aprovado com dados HTTP sintéticos; smoke adicional na aplicação autenticada local conferiu os seis saldos e histórico persistidos.
- A revisão independente encontrou e levou à correção dois limites do formulário: paginação para acessar SKUs após os primeiros 20 e reaproveitamento da chave de idempotência quando a mesma operação é reenviada após perda de resposta. O teste de rede simulou o primeiro POST persistido sem resposta e confirmou que a repetição recebe conflito, sem registrar outro movimento; a UI instrui recarregar.
- A tentativa de `npm test` diretamente no host falhou antes dos testes backend porque o helper Prisma recusa geração fora do ambiente Docker aprovado. A validação completa foi repetida e passou pela imagem Docker do projeto.
- Os saldos de abertura são sintéticos; modo compartilhado só altera as regras internas. Não há ingestão de pedidos, webhooks ou escrita em Shopee/Mercado Livre. Configurações mostram os canais como não configurados.
- Não houve commit, push, merge, publicação ou mudança remota.
