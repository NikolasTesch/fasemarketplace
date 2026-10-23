# Production Environment Implementation Plan

> **For agentic workers:** Execute with superpowers:executing-plans, inline nesta sessão. Etapas sem commit automático, conforme AGENTS.md.

**Goal:** preparar e validar Production Docker isolada e sua configuração Vercel.

**Architecture:** API/worker compilados em outra stack, Neon production, Redis exclusivo; gateway GET diagnóstico e chave exclusiva. A Function seleciona a ponte pelo ambiente Vercel sem fallback.

**Tech Stack:** React/Vite, NestJS/TypeScript, Docker, Neon PostgreSQL, Redis, Vercel Functions.

**Spec:** `docs/specs/SPEC-006-production-docker.md`, desenho aprovado pelo usuário nesta sessão.

## Global Constraints

- MARKETPLACE_MODE=mock; somente SELECT 1/PING, sem funcionalidades ou migrations.
- Preservar `.env`, containers e configuração de Preview existentes.
- Sem commit, push, merge ou promoção automática para main.
- Segredos fora de VITE_, logs, imagens e arquivos versionados.

## Review Focus

- Endpoint cruzado ou host redefinido não deve permitir produção em development.
- Configuração ausente da ponte produtiva não pode reutilizar Preview.
- Reinício do túnel requer origem nova sem alterar o outro ambiente.
- Imagem compilada não pode executar source mounts nem watch.
- Production configurada não significa release promovida nem operação de negócio homologada.

### Task 1: runtime e Function

**Files:** `apps/backend/src/local-config.ts`, `apps/backend/test/local-config.test.cjs`, `server/production-proxy.mjs`, `server/test/production-bridge.test.mjs`, `api/health/ready.mjs`, `server/preview-gateway.mjs`.

**Interfaces:** manter `readLocalConfig(env)` e seu retorno; acrescentar opt-in produtivo estrito. `createProductionProxy({env,fetchImpl})` retorna handler Request→Response; reaproveita sanitização e gateway existentes.

- [x] Escrever testes de Production válida e rejeição de endpoint/ambiente cruzados, TLS e fallback de ponte.
- [x] Executar testes e observar falha esperada antes de implementar.
- [x] Implementar validação e seleção de ponte, preservando Preview fail-closed.
- [x] Executar testes verdes; atualizar interface para identificar Production.

### Task 2: stack e configuração

**Files:** `Dockerfile`, `compose.production.yaml`, `.env.production.example`, `.gitignore`, `scripts/verify-production.ps1`, docs operacionais.

**Interfaces:** `docker compose --env-file .env.production -p fasemarketplace-production -f compose.production.yaml`; API4474/gateway4475 loopback, Redis sem publicação, perfil tunnel.

- [x] Criar target compilado runtime e Compose independente sem bind mounts.
- [x] Preparar exemplos e credenciais exclusivas ignoradas; conferir branch/endpoint Neon e role distinta.
- [x] Validar Compose sem imprimir ambiente, iniciar stack e executar diagnóstico autenticado/401.
- [x] Conferir isolamento, smokes local/híbrido/Preview e checks completos na imagem verify.

### Task 3: Vercel e evidências

**Files:** guias operacionais, AGENTS.md, SPEC-006 e matriz de configuração.

- [x] Configurar variáveis públicas/privadas exclusivamente no escopo Production; manter ponte desabilitada até release aprovada.
- [x] Verificar metadados dos escopos sem imprimir segredos; testar túnel produtivo e preservação do Preview.
- [x] Revisar diff, pedir revisão independente, corrigir achados e registrar evidências/limitações.
- [x] Entregar preparação revisável; promoção main/deploy separado, sem declarar Production Vercel ativa antes disso.

## Execution ledger

Desenho e implementação aprovados pelo usuário. Execução inline, sem commits/publicação. Testes RED observados antes da implementação; GREEN completo no Docker: 8 telemetry + 38 backend + 9 bridge = 55. No host Windows houve timeout no teste Linux do worker; Docker passou. Smokes local, híbrido, Preview e Production passaram. Role limitada criada somente na branch production; sem escrita de negócio. Recuperação do túnel produtivo e Function local 200 → 503 → 200 verificadas. Vercel Production recebeu sete variáveis com ponte desligada. Revisão independente sem achados importantes. Promoção/main/deploy permanecem pendentes de autorização específica conforme AGENTS.md.
