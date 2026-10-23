# Operação do desenvolvimento local

## Escopo e configuração

Preparação autorizada em 23/10/2026. React + Vite e NestJS são a escolha atual do usuário, registrada na SPEC-001; Node 24, npm workspaces, PostgreSQL 17 e Redis 7.4 definidos no bootstrap. A topologia implementa os processos previstos na arquitetura, sem funcionalidades de estoque ou integração real.

| Serviço | Responsabilidade atual | Acesso |
|---|---|---|
| web | React/Vite e página de diagnóstico | 127.0.0.1:4173 por padrão |
| api | NestJS, liveness e readiness | 127.0.0.1:4174 por padrão |
| worker | Contexto Nest separado e heartbeat após conferir dependências | Sem porta |
| postgres | Banco local persistente | Somente rede Docker |
| redis | Persistência AOF e noeviction para futura fila | Somente rede Docker |

`networks.local.internal: true` isola a rede do banco, Redis e worker externamente, conforme a [referência Docker](https://docs.docker.com/reference/compose-file/networks/). API também participa de `frontend`, uma rede bridge com a web para permitir acesso do host às portas loopback. Web não acessa a rede do banco. A rede frontend permite saída de web/API, mas não há clientes de marketplace e o backend recusa configuração externa de banco/Redis. Isto não impede que um administrador Docker conecte manualmente outros containers à rede: não altere a topologia para usar credenciais externas.

Redis usa AOF/everysec e `noeviction`, alinhados às [orientações BullMQ](https://docs.bullmq.io/guide/going-to-production). AOF não substitui o futuro trabalho durável no PostgreSQL. BullMQ ainda não está instalado.

`.env.example` documenta todas as variáveis consumidas pelo Compose. `.env` fica ignorado por Git e pelo contexto de build. Os containers recebem somente as variáveis necessárias; web não recebe credenciais do banco. Backend exige `APP_ENV=local`, `MARKETPLACE_MODE=mock`, hosts `postgres`/`redis` e portas internas padrão, sem query strings nas URLs. Não existem clientes de marketplace nem tokens neste bootstrap.

Os patches de imagem são fixados por digest no Compose/Dockerfile. Para atualizar, consultar suporte e compatibilidade, obter novos digests, atualizar lockfile quando necessário e repetir os checks. Não trocar a major do PostgreSQL sobre um volume existente; planejar migração de dados.

## Inicialização e observabilidade

Comandos completos no [README](../../README.md). `docker compose up --wait` espera os healthchecks. `GET /health/live` atesta processo HTTP; `/health/ready` consulta PostgreSQL e Redis e retorna 503 se uma dependência falhar. Readiness não verifica integridade de estoque, migrations ou APIs externas.

O worker verifica dependências a cada cinco segundos, sem execuções sobrepostas, e grava heartbeat em `/tmp`. O healthcheck recusa heartbeat com mais de vinte segundos. O marker é removido em falha detectada e desligamento; não prova processamento de jobs. O healthcheck da web verifica a entrega de `/`; a página React consulta `/api/health/ready` no navegador. O proxy Vite remove `/api` e encaminha ao NestJS (`http://api:3001`), sem expor endereços Docker ou credenciais no bundle. A interface mostra verificando, disponível ou indisponível. Não há mais endpoint próprio `/health` da web.

Vite usa polling de 500 ms para fontes montadas do Windows. A montagem da web inclui `src/` e `index.html`, somente para leitura. O build gera `dist/` estático; a futura hospedagem deve definir servidor estático e roteamento de `/api`. O proxy é uma configuração de desenvolvimento, não uma solução de publicação.

`docker compose logs -f api worker web` mostra logs técnicos. Erros de conexão do backend são sanitizados. Correlação de requisições/jobs, métricas e tracing serão especificados com os primeiros fluxos de negócio; ainda não há garantia de correlation ID.

## Persistência e recuperação

Volumes: `<projeto>_postgres_data` e `<projeto>_redis_data`. `docker compose down` remove containers/rede e preserva volumes. `up` os reutiliza. Alterar `COMPOSE_PROJECT_NAME` cria outro conjunto; um banco vazio após mudar o nome não significa perda dos volumes antigos.

Não remover volumes nem executar resets sem verificar origem e descartabilidade. Para falhas: consultar `docker compose ps`, logs do serviço e valores locais do `.env` sem publicá-los; corrigir a causa e reiniciar o serviço. Senhas PostgreSQL não são atualizadas em volumes existentes apenas por mudar `.env`.

Para outro checkout local: copiar o exemplo sem segredos, escolher nome de projeto exclusivo e portas livres, executar Compose e o smoke. Recursos remotos e credenciais de vendedor permanecem fora desse fluxo.

## Verificação

Checklist executável: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-local.ps1`. Ele verifica saúde dos cinco serviços, ausência de portas de banco/Redis/worker, loopback de web/API, rede interna, HTML de entrada React e JSON de readiness através do proxy `/api`. Renderização e execução React são verificadas separadamente no navegador.

Instalação limpa/checks: `docker build --target verify -t fasemarketplace-local-verify .`. O stage executa lint, typecheck, testes e build como usuário sem privilégios.

Evidências do bootstrap original estão na [SPEC-000](../specs/SPEC-000-local-bootstrap.md) e da migração atual na [SPEC-001](../specs/SPEC-001-react-vite.md). Nenhum teste de infraestrutura comprova MVP funcional ou homologação de marketplace.

## Referências de stack

- [NestJS](https://docs.nestjs.com/): módulos, controllers, services e injeção de dependências.
- [React com Vite](https://react.dev/learn/build-a-react-app-from-scratch): frontend independente.
- [Vite — opções do servidor](https://vite.dev/config/server-options): proxy e polling no desenvolvimento.
- [Imagem oficial PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/README.md): inicialização e persistência.
