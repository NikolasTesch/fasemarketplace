# SPEC-000 — Ambiente local do MVP

> Registro histórico do bootstrap inicial. A escolha de frontend abaixo foi substituída por React + Vite na [SPEC-001](SPEC-001-react-vite.md), por decisão posterior do usuário. As evidências desta SPEC descrevem a execução original; a stack atual está no README e na SPEC-001.

Data: 23/10/2026. Escopo autorizado: preparar Docker, configuração local e Git. Stack escolhida pelo usuário: SvelteKit + NestJS, com TypeScript.

## Desenho

Um workspace npm contém `apps/web` (SvelteKit) e `apps/backend` (NestJS, com entradas separadas para API e worker). PostgreSQL mantém fatos duráveis; Redis está preparado para a futura fila BullMQ. Não há ainda modelo de estoque, migrations ou processamento de marketplace.

Alternativas consideradas: SvelteKit com backend próprio reduz aplicações; SvelteKit com NestJS separa a API e foi escolhido pelo usuário para aprender as duas tecnologias. Next.js é a tecnologia já conhecida, mas o usuário quer experimentar Svelte.

## Limites

- Dados exclusivamente sintéticos; nenhuma credencial de marketplace ou recurso remoto.
- Rede interna para PostgreSQL, Redis e worker, sem portas publicadas. API compartilha a rede interna e a rede de entrada; web acessa somente a rede de entrada.
- Web e API acessíveis somente em loopback; worker sem porta HTTP.
- Volumes nomeados do projeto, preservados em `docker compose down`.
- Arquivos `.env` ignorados; `.env.example` contém somente exemplos.
- Nenhum commit, remoto, push, CI hospedado, Preview ou Produção nesta entrega.
- Bootstrap técnico não representa MVP funcional nem aprovação das regras de domínio pendentes.

## Critérios de aceite

1. Compose inicia web, API, worker, PostgreSQL e Redis com healthchecks.
2. API distingue liveness de readiness; readiness falha quando uma dependência fica indisponível.
3. Worker mantém sinal de saúde somente após verificar suas dependências.
4. Alterações de código podem ser executadas com watch no Docker.
5. Configuração ausente ou destinada a serviços externos é recusada pelo backend local.
6. Dados de teste persistem após recriar os containers sem remover volumes.
7. Instalação com lockfile, lint, typecheck, testes e build são verificáveis.
8. Git está inicializado em branch de tarefa; nenhum commit automático.

## Plano de execução

- [x] Criar workspace, configuração ignorada, Dockerfile e Compose.
- [x] Preparar NestJS com healthchecks, validação de configuração local e worker.
- [x] Preparar SvelteKit com página de bootstrap e diagnóstico server-side da API.
- [x] Validar configuração, dependências, checks e ciclo de vida do Docker.
- [x] Atualizar README, arquitetura, orientação de agentes e ambientes com evidências.

## Evidências em 23/10/2026

- Docker Desktop ativo; Compose 5.1.3. Imagem Node 24.22.1, NestJS 12.2.0, SvelteKit 3.1.0, Svelte 5.57.2 e TypeScript 6.0.3, conforme imagens e lockfile.
- `docker build --target verify -t fasemarketplace-local-verify .`: instalação por `npm ci`, lint, typecheck, 13 testes e build aprovados; Svelte sem erros ou avisos de diagnóstico.
- `docker compose up -d --build --wait --wait-timeout 180`: cinco serviços saudáveis; smoke pelo host aprovado via Windows PowerShell.
- Redis interrompido deliberadamente: API readiness HTTP 503, liveness HTTP 200, web com indicador explícito de indisponibilidade e heartbeat do worker removido. Redis foi religado; ciclo completo posterior terminou com todos os serviços saudáveis.
- Probes sintéticas `bootstrap_probe.persistence` (PostgreSQL) e `bootstrap:persistence` (Redis) mantiveram o valor `synthetic-local-only` após `down` e `up`, com recriação dos containers e preservação dos volumes. São probes de infraestrutura, sem tabelas ou fixtures de negócio.
- `git check-ignore` confirma exclusão de `.env`, dependências e artefatos de build. Índice vazio, branch inicial `codex/local-bootstrap`, nenhum remoto ou commit.
- Links locais dos documentos alterados conferidos; revisão independente encontrou ambiguidade no smoke e ela foi corrigida para conferir `data-api-ready="true"`.
- Watch confirmado por alterações temporárias no retorno da API e no HTML da web, observadas pelo host sem rebuild/reinício dos containers, e depois revertidas. Os bind mounts desta máquina exigiram polling de 500 ms no tsx/Vite.

Limitações: não há testes de fluxos de estoque, filas reais, migrations, autenticação ou contratos de marketplace. Watch foi validado por respostas HTTP, sem homologação visual de HMR no navegador. Imagem de desenvolvimento não é uma imagem de release. O primeiro acesso do worker pode detectar Redis ainda conectando; a próxima verificação confirma readiness. Após uma falha, `compose up --wait` pode reportar estado unhealthy anterior antes da próxima verificação; consultar logs/estado novamente em vez de apagar volumes.

## Próxima unidade

Especificar o cadastro de SKU e seu modelo de domínio antes de implementar estoque. ORM, contratos de marketplace e regras de reserva permanecem pendentes.
