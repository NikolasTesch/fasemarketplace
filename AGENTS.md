# Orientações para agentes — FaseMarketplace

## Estado do projeto

Este repositório possui documentação e bootstrap local autorizado em 23/10/2026: npm workspaces, React com Vite, NestJS (API e worker separados), PostgreSQL e Redis em Docker Compose. `development` é a base de integração no remoto `origin`; publicação de código não provisiona Preview, Produção ou outros recursos externos. Leia `README.md`, `docs/specs/SPEC-001-react-vite.md` e `docs/operations/local-development.md` para comandos e evidências. O restante do PRD e da arquitetura continua sujeito às decisões de domínio e homologação indicadas nos documentos.

O usuário autorizou iniciar a preparação do MVP e decidiu usar React + Vite + NestJS com TypeScript, priorizando tecnologias familiares para um produto potencialmente produtivo. A escolha anterior de SvelteKit foi substituída; não reintroduzi-la sem nova decisão. Esta autorização cobre a base local; novas funcionalidades devem avançar por specs pequenas. Não inferir aprovação de regras de negócio, contratos de marketplace ou operação externa a partir do bootstrap.

## Fontes de contexto

Antes de uma tarefa relevante, leia:

- `prd.md` — objetivos, escopo, domínio e requisitos propostos.
- `architecture.md` — arquitetura técnica proposta, limites e decisões em aberto.
- `docs/operations/devops-pipeline-workflow.md` — etapas e gates do fluxo de entrega.
- `docs/operations/branch-and-environment-model.md` — ambientes e branches, incluindo o que está definido e o que foi adiado.

Quando fontes divergirem, preserve o que está aprovado pelo usuário, registre a divergência e não transforme uma premissa documental em regra de negócio silenciosamente.

## Processo de trabalho

Para cada unidade relevante, siga:

**DISCOVER → MODEL → SPECIFY → DESIGN → BUILD → VERIFY → REVIEW → DOCUMENT**

- Entenda primeiro o domínio, os documentos e o estado atual dos arquivos/Git.
- Resolva regras de negócio e decisões arquiteturais materiais antes de codificar.
- Prefira specs pequenas com critérios observáveis antes de implementar comportamento.
- Faça mudanças limitadas ao escopo pedido e preserve trabalho existente.
- Registre evidências e limitações; não afirme homologação ou prontidão sem evidência.
- Não faça commit, push, publicação, merge ou deploy automaticamente.

## Desenvolvimento local — prioridade atual

- Decisão mais recente: frontend Vercel, API/worker Docker, Neon remoto e Redis local. Recursos remotos serão criados manualmente pelo usuário. Seguir SPEC-003 e `docs/operations/hybrid-development.md`. Essa decisão substitui restrições anteriores somente para o modo híbrido explícito; não autoriza usar dados/credenciais produtivos nem abrir túnel público sem autenticação.

- Docker Compose é o caminho reproduzível para executar a base local. Use `docker compose up -d --build --wait --wait-timeout 180` e `scripts/verify-local.ps1`.
- API e worker NestJS são processos separados em `apps/backend`; a SPA React/Vite fica em `apps/web`. Regras e persistência de negócio pertencem ao backend. No desenvolvimento, o Vite encaminha `/api` ao NestJS; produção precisará de roteamento equivalente definido na etapa de hospedagem. PostgreSQL 17 e Redis 7.4 estão preparados; BullMQ, ORM, migrations e jobs de marketplace ainda não foram implementados.
- Os serviços locais devem usar dados sintéticos e estar acessíveis somente por interfaces locais. PostgreSQL, Redis e outros serviços internos não devem publicar portas para redes externas sem uma necessidade documentada.
- Integrações Mercado Livre e Shopee devem ser simuladas por padrão no desenvolvimento. Não carregue tokens reais, não use contas reais e não altere anúncios, pedidos ou estoque externos durante desenvolvimento local.
- Segredos ficam fora do Git em arquivos locais ignorados, a serem definidos junto da implementação. Exemplos contêm somente valores fictícios.
- No Compose padrão, não use bancos, storage, filas ou credenciais de Preview/Produção. O Compose independente `compose.hybrid.yaml` aceita somente o endpoint Neon de desenvolvimento confirmado; produção permanece proibida.
- Não execute reset, limpeza destrutiva ou remoção de volumes sem escopo claro e confirmação de que os dados são descartáveis.
- PostHog observa uso/erros, conforme `docs/specs/SPEC-002-posthog.md` e `docs/operations/posthog.md`. Padrão `off`; modo `console` é local. Não enviar a conta/projeto não confirmado nem usar token produtivo localmente. Novos eventos e propriedades passam pelo contrato de `packages/telemetry`; nunca enviar payloads, mensagens originais de erro ou dados pessoais. Replay/autocapture/Self-driving continuam desligados. O override `compose.posthog.yaml` é opt-in para saída do worker e não deve ser aplicado no fluxo local padrão.

## Preview e Produção

Vercel e Neon foram escolhidos para o desenho híbrido da SPEC-003; o usuário fará a criação manual. Preview publicado, autenticação/túnel, promoção para Produção, backup, recuperação e rollback permanecem pendentes. Preparar arquivos não comprova provisionamento ou deploy. Não publicar releases automaticamente.

Não escolha provedor de hospedagem, banco remoto, domínio, armazenamento de objetos, broker hospedado ou plataforma de deploy sem decisão aprovada. Nomes de branches, projetos ou ambientes não provam o destino efetivo de dados.

## Validação

Quando houver código e comandos definidos, use as validações declaradas pelo projeto: testes automatizados, lint, typecheck, build, verificações de migração e inspeção do diff, conforme aplicável. Para mudanças exclusivamente documentais, confira links, consistência entre documentos, status das decisões e o diff disponível. Não alegue que comandos de aplicação foram executados se ainda não existem.

