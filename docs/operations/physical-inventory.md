# Estoque físico local — SPEC de 27/10/2026

Implementado e homologado somente na stack Docker local em 27/10/2026. A API NestJS persiste o ledger no schema `business`; saldos são derivados dos movimentos. A interface React tem estoque físico agrupado por produto, busca por produto/variante/SKU, lançamentos, histórico e configurações. As variantes de cada produto exibem seus saldos e mínimos. O modo local começa separado por canal. A integração com marketplaces, Neon, Preview e Production não foi alterada.

O cabeçalho de cada produto apresenta o preço de venda e, para administradores, o custo unitário. Abaixo das variantes, o valor ao custo e o potencial de venda multiplicam o preço atual do produto pelas quantidades das variantes exibidas, incluindo os saldos físicos destinados aos canais. Uma busca por SKU limita o cálculo às variantes encontradas. Valores ausentes aparecem como não informados; o total ao custo não é uma avaliação contábil histórica.

## Compose local da branch development — 4173

O Compose `fasemarketplace-local` está com `INVENTORY_ENABLED=true`. A população local solicitada pelo usuário totaliza **10 produtos, 23 variantes/SKUs, 500 unidades físicas e 100 unidades de mínimo**. Cada produto tem exatamente 50 unidades somadas entre suas variantes; cada mínimo corresponde a 20% da quantidade do respectivo SKU. As quantidades foram escolhidas em múltiplos de cinco para não arredondar.

As aberturas sintéticas estão em `PHYSICAL_RESERVE`; não há unidades em Shopee ou Mercado Livre. Não foram criados preços/custos nem pedidos. `system:local-seed` identifica as 23 aberturas e políticas. Estes valores servem para visualização local e precisam ser substituídos por contagem física antes de uso comercial. A origem em `fasemarketplace-catalog-local` permanece preservada.

Antes da população, foi criado `backups/catalog/development-before-ten-product-stock-20261027-225341.fmbackup` e validado o restore em quarentena `fm_auth_restore_fcb8a6d043038efb114ce7f0` (PostgreSQL 17).

| Produto | Variante | SKU | Reserva física | Mínimo |
| --- | --- | --- | ---: | ---: |
| Bola de futebol | Tamanho 4 | `BOLA-FUT-4` | 20 | 4 |
| Bola de futebol | Tamanho 5 | `BOLA-FUT-5` | 30 | 6 |
| Boné esportivo | Azul | `BONE-SPORT-AZUL` | 25 | 5 |
| Boné esportivo | Preto | `BONE-SPORT-PRETO` | 25 | 5 |
| Camiseta treino | Azul / M | `CAM-AZ-M` | 15 | 3 |
| Camiseta treino | Preta / G | `CAM-PRETA-G` | 15 | 3 |
| Camiseta treino | Preta / M | `CAM-PRETA-M` | 20 | 4 |
| Corda de pular | Padrão | `CORDA-PULAR-PADRAO` | 30 | 6 |
| Corda de pular | Profissional | `CORDA-PULAR-PRO` | 20 | 4 |
| Garrafa esportiva | Padrão | `GAR-SPORT-750` | 50 | 10 |
| Luva de goleiro | G | `LUVA-GOL-G` | 20 | 4 |
| Luva de goleiro | M | `LUVA-GOL-M` | 15 | 3 |
| Luva de goleiro | P | `LUVA-GOL-P` | 15 | 3 |
| Meia esportiva | Branca / 39–42 | `MEIA-BR-39` | 25 | 5 |
| Meia esportiva | Preta / 39–42 | `MEIA-PR-39` | 25 | 5 |
| Mochila esportiva | Azul | `MOCHILA-AZUL` | 20 | 4 |
| Mochila esportiva | Preta | `MOCHILA-PRETA` | 30 | 6 |
| Short de treino | G | `SHORT-TREINO-G` | 15 | 3 |
| Short de treino | M | `SHORT-TREINO-M` | 15 | 3 |
| Short de treino | P | `SHORT-TREINO-P` | 20 | 4 |
| Tênis de corrida | Preto / 38 | `TEN-COR-PRETO-38` | 15 | 3 |
| Tênis de corrida | Preto / 40 | `TEN-COR-PRETO-40` | 20 | 4 |
| Tênis de corrida | Preto / 42 | `TEN-COR-PRETO-42` | 15 | 3 |

## Dados locais de abertura da demonstração isolada — 4873

Esta tabela pertence ao projeto isolado `fasemarketplace-catalog-local`, não ao Compose atual de development. Foi criada uma abertura sintética para as seis variantes ativas, em `PHYSICAL_RESERVE`, na ordem crescente de SKU. O mínimo inicial é 20% arredondado para cima, por SKU. Esses valores servem para homologação e devem ser substituídos por uma contagem real antes de operação de negócio.

| SKU | Reserva física | Mínimo |
| --- | ---: | ---: |
| CAM-AZ-M | 25 | 5 |
| CAM-PRETA-G | 32 | 7 |
| CAM-PRETA-M | 39 | 8 |
| GAR-SPORT-750 | 46 | 10 |
| MEIA-BR-39 | 53 | 11 |
| MEIA-PR-39 | 60 | 12 |

## Subir a demonstração isolada

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
