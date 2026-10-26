# Persistência de negócio local — Prisma

Implementa a [SPEC-010](../specs/SPEC-010-business-persistence.md), aprovada em 26/10/2026. Prisma CLI/client/adapter-pg **7.10.1**; Node 24/TypeScript 6, PostgreSQL 17/18 ensaiados em Docker. Nenhum modelo de catálogo ou estoque foi introduzido.

## Separação

`public` continua sob controle de Better Auth e dos scripts auth. Prisma controla somente `business`, incluindo `_prisma_migrations`. Nenhuma migração importa ou gerencia usuários existentes. API usa role `fm_business_runtime`, sem DDL, ownership, TRUNCATE ou acesso ao auth; manutenção usa `fm_business_migrator`, proprietária de `business`. Provisionamento usa administrador separado; credenciais e senhas existentes não são alteradas silenciosamente. API e manutenção verificam privilégios excessivos antes de operar.

Configuração aceita somente contexto local, host Docker `postgres`, porta 5432 e alvo explícito `fasemarketplace`, `fm_business_test_*` ou fixtures combinadas `fm_auth_test_business_*`. Somente `?schema=business`, sem parâmetros adicionais. Neon/Preview/Production são recusados antes de conectar. Worker não recebe a configuração de negócio.

## Configuração e comandos

Preencher **somente os campos novos** do `.env` conforme `.env.example`; preservar as outras configurações. Usar senhas exclusivas de runtime, migração e administrador. `BUSINESS_SHADOW_DATABASE_URL` usa a mesma role/senha da migração, em outro banco `fm_business_shadow_*`. A chave de backup de 32 bytes deve ficar em arquivo privado separado, conforme [modelo](../../config/access-backup-key.env.example), nunca no Git ou na imagem. Esta entrega não alterou seus envs de aplicação existentes.

O override `compose.business.yaml` combina exclusivamente com `compose.yaml`. Antes de ativar no ambiente da aplicação, criar o banco shadow descartável vazio via administrador, usando nome correspondente à URL privada. Exemplo, **somente se ainda não existe**:

```powershell
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "CREATE DATABASE fm_business_shadow_local"'
```

O wrapper não cria/remove bancos automaticamente. A role de migração recebe CREATE somente no banco shadow descartável, necessário à geração; não recebe CREATE no banco da aplicação. Não reutilizar um banco com dados como shadow.

Usar o mesmo conjunto de arquivos env privados em cada operação; incluir o arquivo de chave somente na manutenção. Os exemplos abaixo usam `.env.business-backup-key` como nome privado escolhido para essa chave. `BUSINESS_ENABLED=true` habilita a configuração, mas a API só recebe a alteração após seu próximo startup explícito.

```powershell
# Construir a ferramenta de manutenção (cliente PostgreSQL 17 para o Compose local).
docker compose --env-file .env --env-file .env.business-backup-key -f compose.yaml -f compose.business.yaml --profile business-maintenance build business-maintenance

# Backup ANTES de provisionamento/migration; criar backups/business antes do comando.
# O nome deve ser único: arquivos existentes nunca são sobrescritos.
docker compose --env-file .env --env-file .env.business-backup-key -f compose.yaml -f compose.business.yaml run --rm business-maintenance npm run business:backup -- backups/business/antes-business-20261026.fmbackup

# Provisionar explicitamente roles/schema; não rotaciona senhas existentes.
docker compose --env-file .env --env-file .env.business-backup-key -f compose.yaml -f compose.business.yaml run --rm business-maintenance npm run business:provision

docker compose --env-file .env --env-file .env.business-backup-key -f compose.yaml -f compose.business.yaml run --rm business-maintenance npm run business:check
docker compose --env-file .env --env-file .env.business-backup-key -f compose.yaml -f compose.business.yaml run --rm business-maintenance npm run business:migrate

# Ativação local opcional, somente após os checks anteriores.
docker compose --env-file .env -f compose.yaml -f compose.business.yaml up -d --build --wait api
```

Geração de client e validação usam configuração fictícia sem conectar ao banco: `npm run business:generate` / `npm run business:validate`. Build/typecheck geram o client antes de compilar. No Compose opt-in, `src` continua read-only e `src/generated` usa um volume filho descartável, regenerado offline em cada startup. O `.gitkeep` preserva o ponto de montagem em clone limpo. Não contém dados duráveis nem precisa de backup.

Geração de **migrations** é diferente da geração de client. Preparar outro env privado com `BUSINESS_LOCAL_DATABASE=fm_business_test_generate_<nome>` e outro shadow vazio; criar ambos administrativamente e provisionar com esse env. Executar `business:plan` somente nesses bancos descartáveis, nunca no volume da aplicação. O comando recusa qualquer relação preexistente no alvo/shadow. O bind de `apps/backend/prisma` na manutenção preserva as migrations geradas no host mesmo com `run --rm`; revisar SQL/diff antes de aplicar. Esta fase não possui modelos de domínio; o ensaio cria um modelo de fixture somente dentro do container descartável e exporta seu SQL como evidência ignorada, sem adicioná-lo ao produto.

Migrations só executam por comando explícito. API/worker, build e instalação não aplicam schema. O preflight compara checksums e presença de todos os arquivos aplicados e recusa histórico incompleto/alterado/ausente, inclusive antes do `migrate deploy`. Não resolve drift automaticamente nem garante detectar toda alteração manual de estrutura; ensaiar a migration em cópia descartável. Reset, db push e resolve automático não fazem parte dos comandos do projeto.

## Backup e recuperação

Payload v2 inclui `public` e `business` quando existentes; fingerprints incluem schema/nome. Dump e dados das tabelas usam um snapshot exportado; sequences são preservadas pelo pg_dump, com sua semântica PostgreSQL (avanços podem produzir lacunas e não são MVCC). Não alterar sequences/DDL durante backup. Limites permanecem 100 tabelas, 32 MiB de dados/dump e 64 MiB de envelope AES-GCM. Roles/grants globais, Redis e plataformas não fazem parte do arquivo.

Arquivos v1 continuam restauráveis como `public` apenas. A restauração autentica metadados/envelope antes de conectar e cria sempre um banco novo de quarentena `fm_auth_restore_*`, via base Docker `fm_auth_test_*`; nunca restaura sobre o alvo de negócio existente ou no Neon. Filtra schemas permitidos, compara fingerprints e revoga apenas `public.auth_session` / `public.auth_verification` na cópia. Reaplicar roles/grants requer procedimento separado antes de qualquer promoção; uma cópia restaurada não é ativada automaticamente. Usar o [runbook de backup/restore](access-backup.md), com cliente e servidor da mesma major.

Política permanece manual: antes de cada migration, mínimo 30 dias/7 cópias conforme acumuladas, sem exclusão automática, RTO meta 1h/RPO anterior à migration. Guarda somente local foi decisão do usuário; responsável permanente e guarda externa continuam pendentes.

Incidente: parar escritas de negócio, preservar volume e arquivo de backup, registrar commit/migrations e falha sanitizada; verificar se houve aplicação parcial, preferindo correção aditiva revisada. Restaurar em quarentena, conferir conteúdo, schema/sequences e revogação. Não trocar conexão, executar down/reset ou liberar marketplace automaticamente. Cada futura promoção/restauração operacional exige seu escopo e autorização.

## Validação reproduzível

`compose.business-test.yaml` mantém clusters sintéticos independentes por projeto, rede interna e sem portas publicadas; não misturar com Composes da aplicação. Senhas de ensaio ficam em `.env.business-test`, ignorado. Usar projetos distintos e imagem fixada para cada major; nunca trocar a major sobre um volume existente. Os testes retêm bancos de quarentena; nenhum volume preexistente é resetado.

Suítes:

- `npm test`, lint/typecheck/build no target `verify`.
- `node --test apps/backend/test/business.integration.mjs`: roles, migrations, checksums, transações, client Prisma, geração real em alvo/shadow descartáveis. **Rodar em imagem descartável, sem bind do diretório prisma do repositório**, pois o último teste acrescenta uma entidade de fixture somente no container.
- `node --test apps/backend/test/access-backup.integration.mjs`: dados/identidades/senhas auth, negócio, identity/constraints, histórico, arquivos antigos, corrupção e isolamento da revogação. Repetir em 17/18 com ferramentas correspondentes.
- `node --test apps/backend/test/access.integration.mjs`: regressão de login/perfis/sessões no banco sintético dedicado.

Para ensaiar acesso e Prisma simultaneamente sem reutilizar usuários de um banco existente, o runner `node scripts/business-access-rehearsal.mjs` exige a base Docker `fm_auth_test_business`, cria novos bancos de fixture, aplica os dois históricos e executa a suíte de acesso. Requer env privado sintético com `BUSINESS_TEST_RUNTIME_PASSWORD` / `BUSINESS_TEST_MIGRATION_PASSWORD`, segredo auth e Redis local. Não usar credenciais pessoais.

Evidências locais privadas em `backups/business-proof/`; não incluem backups reais remotos nesta entrega. O Preview publicado e Production não foram alterados. A próxima entrega de produto é E03 — catálogo, com regras e spec próprias.

## Evidências de 26/10/2026

- Target `verify`: lint, typecheck, build e **77 testes regulares** passaram (8 telemetria, 52 backend, 17 transporte).
- Persistência real: **8/8 em PostgreSQL 17 e 8/8 em 18**, incluindo Prisma Client/adapter, permissões indevidas recusadas, rollback, histórico e geração de SQL real preservado fora do container.
- Backup/restore: **8/8 em cada major**, com dados auth/business, identity, constraints, histórico, homônimo preservado e arquivos v1 restauráveis.
- Acesso com os dois módulos ativos: **13/13**, em banco novo sintético; o teste Redis passou a aguardar o evento `end` antes de reconectar, corrigindo uma corrida observada no próprio ensaio.
- Smoke com src read-only e nenhum client gerado no host: geração offline + import tsx passaram; API respondeu readiness **200** com PostgreSQL/Redis saudáveis. Container de smoke encerrado depois da conferência.
- Imagem compilada sem pacote CLI `prisma`: client gerado importado e consulta real ao PostgreSQL 18 usando role limitada passaram. Imagem de teste local `fasemarketplace-business-production-image-verify`, sem deployment.
- CLI `business-backup`: **6 tabelas, 17436 bytes**, SHA-256 `c5ced5853bc63d030b6bd5fba9367a628a8450c49130b24a6d01233020bc4de5`; restauração em `fm_auth_restore_793b508276f282d6f9770497`, conteúdo verificado e sessões/verificações revogadas somente na cópia.
- Compose renderizado com profile de manutenção: fonte read-only, volume filho do client, saída de migrations persistida e credenciais administrativas ausentes de API/worker/web. Resultado sanitizado em `backups/business-proof/configuration-check.json`.
- Revisão independente sem P1/P2 remanescentes. Dois achados corrigidos com reprodução RED/GREEN: client escondido pelo bind de src e preflight que aceitava privilégios indevidos no schema business; também validada a persistência da migration gerada.

Todos os bancos e usuários criados nesses testes são sintéticos e locais. Esta evidência não ativa tabelas de negócio no Neon, Preview ou Production, não confirma guarda externa de backup nem autoriza operações reais de marketplace. Branch de trabalho `codex/business-persistence`, sem commit/push/merge desta entrega.

## Autorização posterior de publicação

Em 26/10/2026 o usuário autorizou publicar esta branch, integrar em development e promover o código para main/Vercel Production. A promoção mantém os opt-ins remotos desabilitados e não executa migrations de negócio, não ativa Prisma nos bancos remotos nem reinicia a stack Production. Catálogo segue em SPEC-011 local, em branch/entrega própria após a integração desta base.

Na revalidação pré-release, o processo filho do teste de startup do worker excedeu o timeout de 10s durante imports concorrentes da suíte; isolado, o comportamento passou. O limite do processo de teste foi ajustado para 30s com diagnóstico de erro de spawn. Os intervalos de retry/heartbeat do worker não foram alterados.
