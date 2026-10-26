# Persistência de negócio — plano de implementação

> **Execução:** `superpowers:executing-plans`, nesta sessão. Desenho aprovado pelo usuário em 26/10/2026; sem commits, publicação ou alterações remotas.

**Objetivo:** preparar Prisma e migrations de negócio isoladas, com recuperação conjunta de `public` e `business`.

**Arquitetura:** Prisma controla somente `business`; Better Auth/pg permanece em `public`. Manutenção explícita separada do runtime, com validação local antes de conectar.

**Stack:** Node 24, TypeScript, Prisma 7, PostgreSQL 17/18, Docker.

**Spec:** [SPEC-010](../../specs/SPEC-010-business-persistence.md), aprovada.

## Restrições

- Só Docker local sintético; não tocar Neon, Preview, Production, credenciais pessoais ou volumes existentes.
- Sem entidades de negócio artificiais, alteração de tabelas auth ou migrations automáticas.
- Segredos em envs ignorados, fora de argv/logs e das imagens.
- Preservar backups v1 e envelope AES-GCM; novo payload versionado para dois schemas.

## Foco de revisão

- URL com parâmetros duplicados/escape/contexto errado: recusar antes da conexão (T1).
- Role com ownership ou membership indevidos: recusar manutenção/runtime; auth inacessível (T2).
- Migration ausente/alterada/falha não pode resultar em sucesso (T2).
- Restore confunde tabelas homônimas ou schemas: identidade qualificada e revogação apenas auth (T3).
- Schema sem modelos e build Alpine/ESM: não inventar entidade para gerar client (T1/T4).

## T1 — Configuração e compatibilidade

**Arquivos:** `apps/backend/src/persistence/config.ts`, `apps/backend/test/persistence.test.cjs`, `apps/backend/prisma/schema.prisma`, `apps/backend/prisma.config.ts`, manifests/lock, Dockerfile.

**Interfaces:** `readBusinessConfig(env)` retorna `null` se desativado ou configuração local validada; `readBusinessMaintenanceConfig(env)` exige migração/shadow distintos.

- [x] Escrever testes: opt-in, contexto local, host/DB/schema permitidos, chaves/roles/senhas distintas, URL duplicada/remota recusada.
- [x] Observar RED; implementar validação; observar GREEN após build/backend test.
- [x] Fixar CLI/client/adapter-pg na mesma versão 7.10.1; testar validate/generate no Docker sem modelos, registrar limitação e integrar build conforme resultado.

## T2 — Migrações e permissões locais

**Arquivos:** `scripts/business-config.mjs`, `scripts/business-db.mjs`, `scripts/business-operations.mjs`, `apps/backend/prisma/migrations/`, `apps/backend/test/business.integration.mjs`, Compose opt-in e env example.

**Interfaces:** `runBusinessMaintenance({action, config})` executa check/provision/migrate; operações usam pools diretos validados, credenciais de runtime não possuem DDL.

- [x] Escrever teste integrado descartável: schema/roles próprios, auth preservada, DDL/runtime/auth access negados, reaplicação e checksums.
- [x] Observar RED; implementar provisionamento explícito e wrapper Prisma com ambiente mínimo/erros sanitizados.
- [x] Aplicar histórico de infraestrutura somente em bancos `fm_business_test_*`; preflight compara ledger/arquivos e recusa alteração/ausência/incompleta.
- [x] Testar geração somente em target/shadow descartáveis distintos; nunca resetar dados da aplicação.
- [x] Testar falha/concorrência, rollback/constraints com fixtures; GREEN.

## T3 — Backup de dois schemas

**Arquivos:** `scripts/auth-backup-operations.mjs`, `scripts/auth-backup-format.mjs`, `apps/backend/test/access-backup.integration.mjs`, testes unitários de metadados.

**Interfaces:** `createAccessBackup` passa a produzir payload v2 qualificado; `restoreAccessBackup` aceita v1 public e v2 public/business.

- [x] Escrever teste RED de fixture business com identity/constraint, auth_session homônima e ledger Prisma; restauração preserva ambos e novo INSERT continua sequência.
- [x] Implementar fingerprint qualificado e sequences, snapshot conjunto, dump com schemas permitidos e validação de metadados antes de criar destino.
- [x] Testar arquivos v1 verdadeiros, corrupção/schema inválido/chave errada/cross-major antes de escrita; sessões revogadas só em public.
- [x] Executar integração real em Docker PostgreSQL 17 e 18; manter cópias/bancos de ensaio em quarentena.

## T4 — Integração, regressão e documentação

**Arquivos:** manifests, Dockerfile, exemplos, README, AGENTS, spec/plano MVP, `docs/operations/business-persistence.md`.

- [x] Configuração opt-in não carrega client sem modelos; documentar geração/instanciação adiada para E03 se necessário.
- [x] Executar lint/typecheck/test/build via target verify; integrações auth local e manutenção/backup pertinentes.
- [x] Revisão independente da mudança completa, corrigir achados materiais com testes.
- [x] Documentar comandos/evidências/limitações, conferir diff e links; deixar sem commit/push.
