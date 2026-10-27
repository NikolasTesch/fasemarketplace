# Catálogo básico local — SPEC-011

Implementado e homologado em 27/10/2026 na branch `codex/basic-catalog`, sem publicação deste catálogo. A base Prisma foi integrada em development pelo [PR 13](https://github.com/NikolasTesch/fasemarketplace/pull/13) e em main pelo [PR 14](https://github.com/NikolasTesch/fasemarketplace/pull/14). Production em `a395ffb` retornou 200 na página e no diagnóstico; autenticação e persistência de negócio continuam desabilitadas nesse ambiente. Catálogo não inclui migration Neon ou expansão do gateway remoto.

## Acesso à demonstração

- URL: http://127.0.0.1:4873/; API local em 4874.
- Administrador: `admin@fasemarketplace.local`. Senha exclusiva no arquivo privado `.env.catalog-admin.json` da raiz; troca obrigatória no primeiro acesso. Não copiar para documentação, Git ou Vercel.
- 3 produtos / 6 variantes: Garrafa esportiva (Padrão), Camiseta treino (Preta/M, Preta/G, Azul/M), Meia esportiva (Branca e Preta/39–42).
- Administrador cadastra, edita e inativa; usuário consulta. SKU não pode mudar ou ser reutilizado após inativação. Produto inativo suspende a ativação efetiva de suas variantes sem alterar suas flags individuais.
- Estoque, pedidos, movimentações e marketplaces permanecem demonstrativos. Não existe saldo editável no produto.

## Stack isolada

PostgreSQL 17 e Redis próprios, portas somente loopback, sem credenciais remotas. `.env.catalog-local` é privado e independente dos demais envs. API usa role auth limitada e role business limitada; owner/migrador/shadow ficam na manutenção. Worker não recebe conexão de negócio; web recebe apenas flags públicas.

Para retomar o ambiente já preparado (sem nova migration ou bootstrap):

```powershell
docker compose --env-file .env.catalog-local -p fasemarketplace-catalog-local -f compose.yaml -f compose.business.yaml -f compose.catalog.yaml up -d --wait --wait-timeout 180
```

Para reconstruir após alterações, acrescentar `--build`. Não remover volumes. Nunca combinar esses arquivos com os Composes híbrido, Preview ou Production.

Para outro ambiente novo, partir de `.env.example` e seguir os guias de [acesso](local-access.md) e [Prisma](business-persistence.md): backup/restore, migration auth explícita, provisionamento business e migration business explícitos, depois bootstrap. Não aplicar essas operações ao Neon por inferência. Configurações necessárias:

| Campo | Valor/contexto |
| --- | --- |
| COMPOSE_PROJECT_NAME | Nome exclusivo da stack |
| POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD | Banco/owner locais e senha exclusiva |
| DATABASE_URL / BUSINESS_ADMIN_DATABASE_URL | Owner local, somente manutenção |
| AUTH_ENABLED / BUSINESS_ENABLED / CATALOG_ENABLED | `true`, somente depois do provisionamento |
| AUTH_DATABASE_URL | Role `fm_auth_runtime`, mesmo banco da aplicação |
| BUSINESS_DATABASE_URL | Role `fm_business_runtime`, schema `business`, mesmo banco |
| BUSINESS_MIGRATION_DATABASE_URL | Role `fm_business_migrator`, senha independente |
| BUSINESS_SHADOW_DATABASE_URL | Banco shadow separado e vazio |
| AUTH_SECRET / AUTH_COOKIE_PREFIX | Segredo e namespace exclusivos |
| AUTH_ORIGIN / WEB_PORT / API_PORT | Origem e portas exclusivas, loopback |
| MARKETPLACE_MODE / TELEMETRY_MODE | `mock` / `off` |

As fixtures de automação são uma ferramenta separada, não um seed do produto. `scripts/catalog-fixtures.mjs` exige explicitamente stack `fasemarketplace-catalog-local`, owner `fm_catalog_owner`, banco local `fasemarketplace`, namespace `fm_catalog_access`, `CATALOG_ALLOW_TEST_FIXTURES=true` e JSON privado via stdin. Aceita apenas os dois e-mails sintéticos fixos; preparação recusa contas existentes. Ao terminar, `cleanup --stdin` bloqueia as duas contas e revoga suas sessões. Não usar essas contas para demonstração.

O bootstrap existente cria o primeiro administrador sem pendência. Nesta entrega, antes do handoff, a API administrativa de redefinição de senha foi usada pela conta de homologação para marcar o administrador como provisório e revogar sessões; a senha permanece somente no arquivo privado. Depois, ambas as contas de homologação foram bloqueadas. Estado final verificado: administrador não bloqueado e pendente; fixtures bloqueadas/pendentes; zero sessões.

## Backup e recuperação

Chave independente em `.env.catalog-backup-key`; arquivos criptografados em `backups/catalog/`, ambos ignorados. Guarda somente local conforme decisão anterior: isso não protege contra perda do computador. Sem exclusão automática, retenção mínima 30 dias e 7 cópias à medida que forem produzidas.

Antes das migrations, `pre-20261027.fmbackup` (banco vazio) foi restaurado em quarentena com conteúdo verificado. Após os exemplos, `post-catalog-20261027.fmbackup` incluiu 8 tabelas public/business e teve restore real verificado. Após bloquear fixtures, `handoff-20261027.fmbackup` registrou o estado de entrega e foi restaurado em fm_auth_restore_09f26b8f1bd8b8a148098a75, com conteúdo verificado e sessões/verificações revogadas. SHA-256: `516acc9da3a31c6c7a3de777c3d12f3876dc98bf91e21098fbbc8113ccec0538`.

Exemplo de novo backup, usando nome de arquivo novo:

```powershell
docker run --rm --env-file .env.catalog-local --env-file .env.catalog-backup-key --network fasemarketplace-catalog-local_local --mount "type=bind,source=$((Get-Location).Path)\backups,target=/workspace/backups" fasemarketplace-catalog-final-verify node scripts/business-backup.mjs /workspace/backups/catalog/novo-checkpoint.fmbackup
```

Recuperação segue [backup de acesso](access-backup.md): major 17, base de ensaio `fm_auth_test_*`, destino sempre novo `fm_auth_restore_*`; comparar conteúdo e revogar sessões/verificações na cópia. Não restaurar sobre o banco da aplicação. O helper privado desta homologação cria somente base de quarentena e usa a operação existente de restore.

## Evidências e limitações

- Docker `access-maintenance`: lint, typecheck, suíte regular e build aprovados.
- Catálogo HTTP com auth/PostgreSQL reais: 10 testes; Prisma/migrations/roles: 8; regressão acesso: 13; backup/restore: 8. A primeira tentativa da suíte de backup omitiu a chave privada e recusou antes do backup; repetição com chave separada aprovada.
- Migration `202610270001_catalog` gerada por Prisma em target/shadow descartáveis; duas migrations aplicadas, checksums e reaplicação verificados. Grants por coluna, FK, unique de SKU, rollback e controle de versão testados.
- Navegador: criação real com duas variantes, recusa de SKU duplicado preservando rascunho, edição, nova variante, SKU read-only, ativação efetiva, busca/filtro, vazio, erro/retry, usuário sem escrita, sessão expirada e troca obrigatória. Repetido após reinício da API, mantendo os 3 produtos/6 variantes. Sem erros JavaScript, browser storage ou overflow mobile.
- Capturas e relatório privados: `backups/catalog/catalog-desktop.png`, `catalog-mobile.png`, `ui-validation.json`. Mobile inclui entrada Catálogo na navegação.
- Revisão independente estática sem achados P1/P2; revisão própria incluiu diff, permissões e limites de autenticação.

Próxima fatia: especificar entradas/saídas/ajustes de estoque e regras de saldo antes de substituir as simulações. Publicar o catálogo ou migrar bancos remotos exige autorização própria.
