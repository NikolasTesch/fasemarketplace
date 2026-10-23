# SPEC-006 — Production técnica em Docker separado

**Data:** 23/10/2026.
**Estado:** implementada, publicada e ativada após autorização explícita. Backend Docker e frontend/Function Production Vercel validados. [Registro da ativação](../operations/production-release-2026-10-23.md) e [operação produtiva](../operations/production-docker.md).

## Objetivo e decisão

Concluir a configuração dos ambientes antes de desenvolver funcionalidades. O usuário escolheu manter o backend de Production no próprio computador, separado do desenvolvimento, com frontend/Function na Vercel e banco na branch `production` do Neon.

Alternativas consideradas: reservar Production sem backend (não atende à ativação solicitada); contratar hospedagem externa (adiada pelo usuário); executar outra stack Docker no computador (escolhida, sem contratar servidor). A disponibilidade depende do computador, Docker, internet e túnel. Não há garantia de disponibilidade contínua.

## Desenho aprovado

Navegador → frontend Vercel Production → Function `/api/health/ready` → túnel HTTPS exclusivo → gateway autenticado → API Production → Neon Production e Redis exclusivo. Worker separado usa os mesmos recursos produtivos. O acesso externo continua restrito ao diagnóstico; esta entrega não cria uma API de negócio nem autenticação de usuários.

- Novo Compose independente `compose.production.yaml`, projeto explícito `fasemarketplace-production`, sem mesclar arquivos de desenvolvimento. API e worker executam JavaScript compilado de uma imagem identificada pelo commit, sem watch ou montagem do código-fonte. Imagem construída sem arquivos `.env`.
- API loopback `4474`, gateway loopback `4475`; Redis sem porta publicada. Redes, volume Redis e credenciais da ponte exclusivos. Não há frontend Vite nesta stack.
- Arquivo local ignorado `.env.production`, carregado explicitamente por `--env-file`; `.env.production.example` versionado com valores fictícios. `.env` permanece para local/development e `.env.local` da CLI Vercel não vira configuração do backend produtivo.
- `APP_ENV=production`, `DATABASE_PROVIDER=neon`, `NEON_BRANCH=production`, TLS `verify-full` e conferência do hostname completo. Uma configuração produtiva não pode aceitar o endpoint de development, e a configuração híbrida deve continuar recusando o endpoint produtivo. Conferir identidades dos endpoints no Neon antes da conexão.
- `MARKETPLACE_MODE=mock` permanece obrigatório. Nenhuma migration, seed, credencial de vendedor ou escrita de negócio é incluída. Prontidão consulta apenas `SELECT 1` e `PING`; worker ainda mantém somente heartbeat.
- Nova ponte Production opt-in, com `PRODUCTION_BRIDGE_ENABLED`, `PRODUCTION_BRIDGE_ORIGIN` e `PRODUCTION_BRIDGE_KEY`. A Function escolhe exclusivamente a configuração correspondente a `VERCEL_ENV`; nunca faz fallback para a chave/origem de Preview. O gateway mantém autenticação, comparação em tempo constante, limites de concorrência/tamanho/timeout e allowlist de rota existentes.
- Túnel temporário separado com perfil explícito `tunnel`. A URL muda ao reiniciar; atualizar somente a variável do ambiente correspondente e redeployar esse ambiente. O domínio gratuito `vercel.app` continua sendo o endereço do frontend; não hospeda o Docker nem substitui o túnel.
- Confirmar a proteção de acesso efetiva em Production e Preview antes da ativação. Não ampliar rotas externas nesta entrega. Backup/restore, autenticação de produto, filas e operações reais continuam gates anteriores ao uso operacional com dados reais.

Os nomes de arquivos/variáveis e portas foram propostos pelo agente e aprovados junto do desenho. A escolha da stack Docker separada foi feita pelo usuário.

## Identidades conferidas nesta etapa

Projeto Neon `autumn-shadow-97219766`, região `aws-sa-east-1`, PostgreSQL 18:

| Ambiente | Branch Neon | Endpoint pooled |
| --- | --- | --- |
| Development | `development` / `br-fancy-waterfall-b6tbiwl1` | `ep-soft-bird-b61xykn1-pooler.c-2.sa-east-1.aws.neon.tech` |
| Production | `production` / `br-late-forest-b6ahi80p` | `ep-round-cell-b66do3rp-pooler.c-2.sa-east-1.aws.neon.tech` |

Esses são identificadores públicos de infraestrutura, não credenciais. Branches distintas não garantem senhas distintas: conferir roles e preparar credenciais exclusivas antes da ativação, sem imprimir URLs de conexão.

## Critérios de aceitação

1. Local e Preview continuam passando seus smokes; iniciar/parar Production não altera seus containers, volumes, endpoints ou variáveis.
2. Testes demonstram rejeição de endpoints cruzados, configuração ambígua, TLS inseguro e modo real. Segredos não aparecem em erro, resposta, bundle web ou diff.
3. Testes da Function demonstram isolamento entre Preview e Production, opt-in obrigatório e indisponibilidade genérica quando a ponte falha. Gateway sem chave retorna 401 sem consultar a API.
4. Containers produtivos saudáveis; diagnóstico real retorna PostgreSQL/Redis disponíveis usando a identidade produtiva verificada. Isso não comprova recuperação ou funcionamento de jobs de negócio.
5. Variáveis da Vercel conferidas por escopo; navegador recebe somente valores públicos. Connection string Neon, Redis e chave da ponte permanecem no servidor correto.
6. Lint, typecheck, testes, build, inspeção do diff e revisão concluem a preparação. Publicação/promoção do código para `main` é uma etapa explícita, com evidências do commit e configuração efetiva antes do deploy.

## Situação atual

Antes desta implementação, backend e Function recusavam Production e apenas Preview/development tinha sete variáveis. Agora há outra stack Docker saudável, role Neon exclusiva limitada, `.env.production` privado e túnel autenticado próprios. Sete variáveis produtivas foram cadastradas e a ponte ativada após publicação/revisão autorizadas. O frontend Production consulta sua API exclusiva; Preview permanece isolado e protegido. Development da Vercel permanece sem variáveis porque o fluxo local usa Docker.

Consultar a [matriz de configuração](../operations/environment-configuration.md).
