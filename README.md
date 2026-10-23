# FaseMarketplace

Configuração por ambiente: [matriz e explicação dos arquivos env](docs/operations/environment-configuration.md). Production Docker isolada foi aprovada na [SPEC-006](docs/specs/SPEC-006-production-docker.md); consulte [operação produtiva](docs/operations/production-docker.md) para estado, comandos e limites. Preparação técnica não significa promoção de código para `main`.

Configuração manual de **Vercel + API/worker Docker + Neon**: [guia híbrido](docs/operations/hybrid-development.md). O `.env` mantém os valores locais e acrescenta campos Neon vazios. `compose.hybrid.yaml` é independente; não aplicá-lo como override. Recursos externos e publicação ainda dependem da configuração manual descrita no guia.

**Preview Vercel de development configurado**, com ponte autenticada de diagnóstico e túnel temporário, conforme [operação e limitações](docs/operations/protected-preview.md). A chave privada permanece somente no servidor. O frontend usa `/api` na própria Vercel. O Preview depende do Docker e do túnel ativos; não é um backend produtivo hospedado.

Hub de estoque próprio e integração com Mercado Livre e Shopee, em preparação para o MVP. A base técnica local está implementada; cadastro, estoque, autenticação e integrações de negócio ainda não existem.

## Stack

- TypeScript; React com Vite para interface e NestJS para API e worker.
- PostgreSQL 17 para fatos duráveis; Redis 7.4 preparado para futura fila BullMQ (a biblioteca e os jobs ainda não foram implementados).
- Node 24 no Docker, npm workspaces e lockfile único. Imagens fixadas por digest.
- `apps/web`: SPA React e diagnóstico da API no navegador, usando `/api` com proxy local do Vite.
- `apps/backend`: API HTTP e processo worker separados; sem ORM escolhido nesta etapa.
- `packages/telemetry`: contrato compartilhado de eventos e sanitização para PostHog, desligado por padrão.

## Iniciar no Windows / PowerShell

Pré-requisitos: Git e Docker Desktop em modo Linux, com Compose v2.20 ou superior. Os comandos abaixo são executados na raiz do projeto.

```powershell
# Somente no primeiro uso; preserve um .env que já exista.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up -d --build --wait --wait-timeout 180
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-local.ps1
```

- Interface: [http://127.0.0.1:4173](http://127.0.0.1:4173).
- API viva: [http://127.0.0.1:4174/health/live](http://127.0.0.1:4174/health/live).
- API pronta e dependências: [http://127.0.0.1:4174/health/ready](http://127.0.0.1:4174/health/ready).

Se as portas estiverem ocupadas, altere `WEB_PORT` / `API_PORT` no `.env` e recrie os serviços. A senha do exemplo é fictícia e exclusiva de ambiente local isolado. Não use credenciais de vendedor ou recursos remotos. Se mudar usuário, senha ou banco, ajuste também `DATABASE_URL`. Variáveis `POSTGRES_*` inicializam apenas volumes novos: editar `.env` não altera a senha de um banco já criado.

O Compose não precisa de Node instalado no Windows. Para executar npm diretamente no host, use Node 24.15 ou superior da linha 24. O runtime Docker efetivo é registrado em [local-development.md](docs/operations/local-development.md).

## Desenvolvimento e verificações

Para a interface conectada ao **Neon de desenvolvimento**, após configurar os campos Neon no `.env`:

```powershell
docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml up -d --build --wait --wait-timeout 180
pwsh -NoProfile -File scripts/verify-hybrid.ps1
```

Abra **http://127.0.0.1:4273** (API em 4274). O endereço 4173 continua no ambiente totalmente local. A web híbrida usa proxy interno e não recebe credenciais do banco. Não preencher novos campos de API pública para esse teste; publicação e acesso HTTPS externo continuam pendentes. Consulte a [SPEC-004](docs/specs/SPEC-004-hybrid-frontend.md).

Arquivos de `apps/*/src` são montados somente para leitura nos containers; você os edita no host e os processos usam watch com polling de 500 ms, necessário para os bind mounts Windows/Docker Desktop desta máquina. Polling aumenta o trabalho de verificação de arquivos, mas fica limitado às árvores observadas pelos processos. Mudanças em dependências, configurações ou Dockerfile exigem novo build.

```powershell
docker compose ps
docker compose logs -f api worker web
docker compose exec api npm run lint
docker compose exec api npm run typecheck
docker compose exec api npm test
docker compose exec api npm run build
# Instalação limpa e todos os checks em imagem independente:
docker build --target verify -t fasemarketplace-local-verify .
```

ESLint cobre o TypeScript do backend e frontend, incluindo regras de hooks React. Typecheck usa TypeScript nos dois workspaces. O smoke confere HTML de entrada e o proxy web → API; a execução/renderização React é verificada separadamente no navegador. Não há testes funcionais de estoque, migrations ou homologação de marketplace. Healthchecks comprovam somente a base técnica.

`npm run build --workspace @fasemarketplace/web` gera arquivos estáticos em `apps/web/dist`. `vite dev` e `vite preview` servem apenas ao desenvolvimento/verificação local. O proxy `/api` está configurado para o Docker de desenvolvimento; antes de publicar, definir servidor estático, fallback da SPA e roteamento `/api` para NestJS. O frontend não precisa de um servidor SvelteKit/Next.js em produção. Nenhuma hospedagem foi configurada nesta etapa.

```powershell
# Acesso interno; nenhum banco/Redis publicado no host:
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec redis redis-cli
# Parar preservando dados:
docker compose down
# Subir novamente, reutilizando volumes:
docker compose up -d --wait --wait-timeout 180
```

Não use `down --volumes`, `volume prune` ou reset para resolver falhas. Volumes locais são persistentes e não substituem backup. O worker atual verifica dependências e mantém um heartbeat; ainda não consome jobs.

## Git e ambientes

`development` é a base de integração; branches de tarefa usam `codex/<tarefa>`. `main` fica reservada ao fluxo futuro de Produção. O remoto GitHub `origin` recebe o código-fonte e a documentação; isso não cria Preview, Produção, banco ou deployment. Cada checkout adicional deve usar outro `COMPOSE_PROJECT_NAME` e outras portas no seu `.env`; Compose separa rede e volumes pelo nome do projeto. Não reutilize nome entre checkouts em execução. Os recursos de outros projetos Docker não são alterados.

Cada checkout adicional deve usar outro `COMPOSE_PROJECT_NAME` e outras portas no seu `.env`; Compose separa rede e volumes pelo nome do projeto. Não reutilize nome entre checkouts em execução. Os recursos de outros projetos Docker não são alterados.

Preview e Produção ainda não foram criados. Consulte os limites e passos futuros em [modelo de ambientes](docs/operations/branch-and-environment-model.md) e [fluxo de entrega](docs/operations/devops-pipeline-workflow.md).

## Uso do produto e diagnóstico

PostHog está integrado ao React, API e worker para eventos explícitos e erros sanitizados. O padrão `TELEMETRY_MODE=off` não envia dados; `console` permite validar os eventos localmente. Ativação externa depende de criar/confirmar um projeto de desenvolvimento e configurar token público de ingestão e região. Consulte o [guia PostHog](docs/operations/posthog.md) para onboarding, catálogo, privacidade, modos e o override opcional de saída do worker. Relatórios de vendas/estoque continuam no backend; replay, autocapture e Self-driving estão desativados.

## Documentação e próxima etapa

- [PRD](prd.md) e [arquitetura](architecture.md): propostas de produto e regras pendentes.
- [SPEC-000](docs/specs/SPEC-000-local-bootstrap.md): escopo deste bootstrap.
- [SPEC-001](docs/specs/SPEC-001-react-vite.md): decisão atual e migração para React com Vite.
- [SPEC-002](docs/specs/SPEC-002-posthog.md): análise de uso e diagnóstico técnico com PostHog.
- [SPEC-003](docs/specs/SPEC-003-hybrid-development.md): configuração Docker + Neon de desenvolvimento.
- [SPEC-004](docs/specs/SPEC-004-hybrid-frontend.md): interface local conectada à API híbrida e ao Neon.
- [SPEC-005](docs/specs/SPEC-005-protected-preview.md): ponte autenticada de diagnóstico para Preview.
- [Operação local](docs/operations/local-development.md): configuração, diagnóstico e evidências.
- [Design](docs/design.md): referência visual da empresa.
- [AGENTS.md](AGENTS.md): regras para trabalhar no projeto.

Próxima fatia: especificar cadastro de SKU, escolher persistência/migrations e definir critérios de aceite, antes de implementar regras de estoque. Regras de reserva, estados de pedido e contratos de marketplace continuam exigindo validação.
