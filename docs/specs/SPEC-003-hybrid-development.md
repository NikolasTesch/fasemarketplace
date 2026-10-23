# SPEC-003 — Desenvolvimento híbrido

## Decisão e escopo

Em 23/10/2026 o usuário escolheu frontend React/Vite na Vercel, API e worker no Docker local, PostgreSQL no Neon e Redis local. O frontend continua uma SPA estática; nenhuma responsabilidade de Cloud Function foi definida. Publicação depende de confirmar acesso/plano na Vercel e proteger o acesso HTTPS ao backend. Não expor a API sem autenticação, nem publicar PostgreSQL/Redis.

## Comportamento

- Compose padrão permanece completamente local, somente mock, sem credenciais remotas.
- Um Compose separado permite DATABASE_PROVIDER=neon somente com APP_ENV=local, MARKETPLACE_MODE=mock e NEON_BRANCH=development.
- A URL deve usar PostgreSQL, credenciais, banco, endpoint pooled Neon explicitamente confirmado e sslmode=verify-full. Rejeitar parâmetros adicionais e destinos diferentes sem revelar segredos.
- Redis continua no serviço interno redis:6379. Somente API e worker ganham saída de rede no modo híbrido.
- Não copiar dados locais nem executar migrations de produto nesta etapa.
- A sondagem periódica remota deve permitir suspensão do Neon entre usos; o heartbeat local do worker não equivale a prova contínua da disponibilidade do banco remoto.
- Neon production fica reservado e desconectado do desenvolvimento. Separação nominal não substitui validar endpoint/branch efetivos.

## Plano de execução

1. Testar configuração local inalterada e rejeições do modo Neon: TLS, host, branch, credenciais, query e modo real.
2. Implementar configuração opt-in e Compose independente, com exemplo sem segredos.
3. Preparar build estático da Vercel e URL HTTPS configurável da API, sem publicar ou expor endpoints.
4. Orientar criação manual do Neon na organização confirmada; usuário decidiu criar os recursos. Guardar conexão em arquivo ignorado, nunca em VITE_.
5. Rodar lint, typecheck, testes, build e smoke local; testar SELECT 1 remoto se credenciais estiverem disponíveis.
6. Revisar código e documentar pendências de acesso/túnel/autenticação e publicação.

## Aceite

Configuração inválida falha antes de criar clientes; fluxo local continua saudável; build web não contém conexão do banco; não há deploy, túnel público ou operação produtiva implícita. Provisionamento e testes reais devem ser registrados separadamente da configuração preparada.

## Evidência

Lint, typecheck, 42 testes e build passaram no Docker. Compose híbrido validado com credenciais sintéticas e nome de projeto explícito (`-p fasemarketplace-hybrid`) para não herdar COMPOSE_PROJECT_NAME do fluxo local. `.env` preserva configurações existentes e recebe somente campos faltantes. Conexão real e publicação aguardam configuração manual; não alegar ambiente remoto pronto.
