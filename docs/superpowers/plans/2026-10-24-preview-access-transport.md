# Plano E01.2 — Transporte de autenticação Preview

> Executar inline com `superpowers:executing-plans` e TDD. Usuário solicitou continuar a implementação do plano em 24/10/2026. Esta execução implementa e ensaia localmente; não publica, não migra Neon e não altera Production.

**Objetivo:** preparar a ponte de login com cookies seguros e contexto de cliente verificado até o NestJS.
**Arquitetura:** mesma origem na Vercel, gateway Docker e API; chaves independentes em cada salto e sessão Better Auth no servidor.
**Spec:** [SPEC-008](../../specs/SPEC-008-preview-access.md). **Stack:** TypeScript/Node 24, NestJS, Better Auth 1.7.12; sem nova dependência.

## Restrições e decisões

- Preservar autenticação local e gateway de diagnóstico existentes; feature remota desligada por padrão.
- Sem alterar credenciais/envs das stacks em execução ou configurar Vercel/Neon. Fixture usa apenas PostgreSQL/Redis descartáveis.
- Ruling: manter a alternativa de mesma origem já recomendada e a topologia atual; a solicitação reiterada de execução permite preparar código/ensaios locais, sem tratar isso como autorização de ativação externa.
- Ruling: fechar metadados com duas credenciais de transporte, evitando protocolo novo de sessão ou confiança em IP/header arbitrário. O gateway não recebe segredo de sessão/banco; Function não recebe credencial da API.
- Incertezas operacionais (RPO/RTO e recuperação remota executada) são gates explícitos, não flags de bypass.

## Tarefas

### P01 — Contrato e testes RED da ponte

Arquivos: `server/test/access-bridge.test.mjs`, `server/access-bridge.mjs`.

- [x] Escrever testes de opt-in desligado/Production/branch/host, allowlist/método/query, Origin/JSON/8KiB, IP/chaves e observar RED.
- [x] Testar filtro de cookies e DTOs, múltiplos Set-Cookie, erros/redirect/64KiB e comprovar que dados privados não são refletidos.
- [x] Implementar funções puras `createAccessProxy` e `createAccessGatewayHandler`, sem acessar rede até configuração explícita válida; chegar a GREEN.

### P02 — Contexto Preview no backend

Arquivos: `apps/backend/src/access/{config,transport,auth,service}.ts`, `apps/backend/test/access-preview.test.cjs`.

- [x] Testes RED de config Preview, credencial/IP forjados e cookies Secure, preservando config local.
- [x] Reusar validação de endpoint existente, role auth própria, TLS, prefixo/segredo e tempo de conexão; aplicar verificação do transporte antes de login/principal.
- [x] Usar IP verificado no limitador somente no contexto Preview; não confiar em trust-proxy genérico.

### P03 — Adapter de Function/gateway e exemplos

Arquivos: `api/access/[...path].mjs`, `server/preview-gateway.mjs`, `compose.preview-access.yaml`, `.env.example`, `vercel.json`.

- [x] Montar somente rotas aprovadas, manter comportamento padrão do diagnóstico e timeout/concurrency limitados.
- [x] Adicionar override/envs fictícios com ativação desligada. Worker sem segredos de acesso; não aplicar override real.
- [x] Testar recusa de Production e diagnósticos anteriores sem regressão.

### P04 — Ensaio completo e revisão

Arquivos: `apps/backend/test/access-preview.integration.mjs`, guia operacional/evidências.

- [x] Ensaio de Function → gateway HTTP → NestJS → PostgreSQL/Redis reais descartáveis, com contexto Preview injetado exclusivamente no teste; não criar flag de produção que aceite banco fictício.
- [x] Testar login/sessão/logout e cookie Secure, IP independente, rejeição de chamadas diretas/origem forjada e respostas sem tokens.
- [x] Executar regressão local, lint/typecheck/build/testes; revisão independente e documentação.
- [x] Registrar o que foi preparado e o que continua pendente de homologação HTTPS, backup/migration/recuperação Neon e autorização de publicação.

## Gate externo

Somente depois do código/ensaio revisados: preparar comandos concretos de backup/migration/bootstrap/recovery e pedir autorização de Preview. Nenhuma tarefa desta execução promove para main ou cria identidade remota.

## Resultado desta execução

Transporte e ensaio local concluídos. Docker verify passou lint/typecheck, 66 testes regulares e build; integração local 13/13 e cadeia Preview descartável 8/8. Revisão independente sem P1/P2. Override validado com valores sintéticos e não aplicado. Sem commit/push/deploy/migration Neon. Ver docs/operations/preview-access-preparation.md para evidências e pendências operacionais; E01.2 remota permanece pendente.
