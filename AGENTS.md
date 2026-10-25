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
- Para desenvolvimento com Neon, usar `docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml up -d --build --wait --wait-timeout 180` e `scripts/verify-hybrid.ps1`. A web em 4273 usa API híbrida/Neon; 4173 continua completamente local. Não herdar o ambiente do backend no serviço web. SPEC-004 registra essa entrega, sem deploy externo.
- API e worker NestJS são processos separados em `apps/backend`; a SPA React/Vite fica em `apps/web`. Regras e persistência de negócio pertencem ao backend. No desenvolvimento, o Vite encaminha `/api` ao NestJS; produção precisará de roteamento equivalente definido na etapa de hospedagem. PostgreSQL 17 e Redis 7.4 estão preparados; BullMQ, ORM, migrations e jobs de marketplace ainda não foram implementados.
- Os serviços locais devem usar dados sintéticos e estar acessíveis somente por interfaces locais. PostgreSQL, Redis e outros serviços internos não devem publicar portas para redes externas sem uma necessidade documentada.
- Integrações Mercado Livre e Shopee devem ser simuladas por padrão no desenvolvimento. Não carregue tokens reais, não use contas reais e não altere anúncios, pedidos ou estoque externos durante desenvolvimento local.
- Segredos ficam fora do Git em arquivos locais ignorados, a serem definidos junto da implementação. Exemplos contêm somente valores fictícios.
- No Compose padrão, não use bancos, storage, filas ou credenciais de Preview/Produção. O Compose independente `compose.hybrid.yaml` aceita somente o endpoint Neon de desenvolvimento confirmado; produção permanece proibida.
- Não execute reset, limpeza destrutiva ou remoção de volumes sem escopo claro e confirmação de que os dados são descartáveis.
- PostHog observa uso/erros, conforme `docs/specs/SPEC-002-posthog.md` e `docs/operations/posthog.md`. Padrão `off`; modo `console` é local. Não enviar a conta/projeto não confirmado nem usar token produtivo localmente. Novos eventos e propriedades passam pelo contrato de `packages/telemetry`; nunca enviar payloads, mensagens originais de erro ou dados pessoais. Replay/autocapture/Self-driving continuam desligados. O override `compose.posthog.yaml` é opt-in para saída do worker e não deve ser aplicado no fluxo local padrão.

## Preview e Produção

SPEC-005 implementa gateway opt-in `compose.preview.yaml` e Function Vercel somente para GET diagnóstico. Em 23/10/2026 o usuário autorizou merge em development e configuração do Preview: proteção de acesso e prontidão externa foram verificadas. O túnel temporário Docker usa perfil explícito `tunnel`; sua URL muda ao reiniciar. Consultar `docs/operations/protected-preview.md`. Nunca usar PREVIEW_BRIDGE_KEY em VITE_, enviar ao navegador ou imprimir config completa. A Function exige Preview e ativação explícita; verificar Deployment Protection antes de ativar. Não expor a API/Vite diretamente no túnel.

Preview de development está configurado no projeto Vercel fasemarketplace do time nikolasdtesch-4933s-projects. Production usa main e foi promovida/ativada com autorização explícita em 23/10/2026; diagnóstico publicado validado. Ver docs/operations/production-release-2026-10-23.md. Autenticação de produto e backup/recuperação continuam pendentes. Não inferir autorização para futuras publicações, merge em main ou escritas de negócio a partir desta ativação de Preview.

Decisão posterior aprovada pelo usuário: preparar e validar backend Production ativo no próprio computador em stack Docker separada (SPEC-006). `compose.production.yaml` é independente: usar explicitamente `--env-file .env.production -p fasemarketplace-production`, nunca mesclar com os Composes anteriores. API/worker compilados, Redis/volume/redes e role Neon exclusivos, gateway e túnel próprios. `.env.production.example` contém somente modelo; arquivo privado não deve ser sobrescrito ou impresso. Configuração produtiva aceita somente endpoint/role aprovados, `MARKETPLACE_MODE=mock` e TLS verify-full. Ver `docs/operations/production-docker.md` e matriz `environment-configuration.md`. Ponte Vercel Production usa exclusivamente `PRODUCTION_BRIDGE_*`; está ativa após promoção autorizada, com sete variáveis exclusivas e release 2026-10-23-spec006. Futuras publicações continuam exigindo autorização própria. Nenhuma credencial de banco/Redis vai para Vercel ou VITE_. O domínio produtivo atual é público; não ampliar rotas/dados sem autenticação. Esta autorização não inclui commit, push, merge, promoção de código ou operações de negócio automáticas.

Não escolha provedor de hospedagem, banco remoto, domínio, armazenamento de objetos, broker hospedado ou plataforma de deploy sem decisão aprovada. Nomes de branches, projetos ou ambientes não provam o destino efetivo de dados.

## Validação

E01.2 tem transporte de acesso Preview preparado, ainda sem ativação remota: ler `docs/specs/SPEC-008-preview-access.md` e `docs/operations/preview-access-preparation.md`. `compose.preview-access.yaml` é override explícito futuro, nunca Production. Function/gateway/API usam duas credenciais de transporte independentes, IP verificado e cookies do namespace Preview; API exige role limitada em ambos pools. Os scripts auth-local/auth-generate continuam local-only pelo helper `readLocalAccessOperationConfig`. A ferramenta dedicada auth-preview valida owner direto e runtime Preview antes de conectar; consultar `docs/operations/preview-access-maintenance.md`. A API usa advisory lock transacional para compatibilidade com pooler; não reintroduzir lock de sessão no runtime pooled. Não abrir rotas genéricas, confiar em XFF direto, migrar Neon ou configurar Vercel por inferência desta preparação.

SPEC-009 prepara backup/restore local em `docs/operations/access-backup.md`. Target Docker `access-maintenance` é opt-in, separado de API/worker/Production. Chave privada fora do Git/imagem/backups. CLI restore-local exige base `fm_auth_test_*` no host postgres e sempre cria novo `fm_auth_restore_*`; nunca aceitar alvo existente, --clean ou restore Neon. Remove somente schema public vazio do DB recém-criado, sem CASCADE. Compara fingerprints e revoga sessões/verificações somente na cópia restaurada. Política development aprovada em 24/10/2026: manual antes da migration, retenção mínima 30 dias/7 cópias, sem exclusão automática, RTO meta 1h/RPO anterior à migration. Responsável, guarda externa e backup/restore real Neon ainda pendentes. Não confundir ensaio sintético com recuperação remota homologada.

Atualização 25/10/2026: usuário escolheu guarda somente local por enquanto, adiando guarda externa. Backup real do baseline development (Neon PostgreSQL 18, public vazio) restaurado no Docker 18: `docs/operations/neon-development-recovery-2026-10-25.md`. Target `access-maintenance18` e Compose `compose.recovery18.yaml` são independentes; nunca mesclar com app/Production nem reutilizar volume 17. Arquivo, servidor e cliente precisam da mesma major 17/18, verificados antes de criar destino. Sem portas publicadas e rede interna. Ensaio real vazio não prova recuperação de usuários existentes; fixtures completas foram testadas em 17/18. Migration/bootstrap remotos, publicação e ativação Preview ainda exigem autorização específica; não inferir a partir do backup.

Plano ativo do MVP: `docs/superpowers/plans/2026-10-24-mvp-integrations.md`. E01.1 integra SPEC-007 às telas somente no Docker local, com Better Auth opt-in; consultar `docs/operations/mvp-access-integration-2026-10-24.md`. Não remover guards/pendência nem confundir a identidade autenticada com o operador fictício do modo demonstração. Auth não é habilitada no híbrido/Preview/Production por esta entrega. Segredo somente na API; migration/bootstrap explícitos; testes destrutivos de fixtures somente em `fm_auth_test_*`. Catálogo, estoque e demais fluxos ainda simulados exigem specs próprias.

Quando houver código e comandos definidos, use as validações declaradas pelo projeto: testes automatizados, lint, typecheck, build, verificações de migração e inspeção do diff, conforme aplicável. Para mudanças exclusivamente documentais, confira links, consistência entre documentos, status das decisões e o diff disponível. Não alegue que comandos de aplicação foram executados se ainda não existem.

