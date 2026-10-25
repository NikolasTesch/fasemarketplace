# Preparação do login no Preview — E01.2

**Estado:** transporte implementado para ensaio local; não ativado na Vercel ou no Neon. Esta entrega não executou migration, criou role/usuário remoto ou publicou código.

Fontes: [SPEC-008](../specs/SPEC-008-preview-access.md), [plano da fatia](../superpowers/plans/2026-10-24-preview-access-transport.md) e [plano do MVP](../superpowers/plans/2026-10-24-mvp-integrations.md).

## Caminho preparado

```text
Navegador no alias canônico de development
  → /api/access/* na Function (VERCEL_ENV=preview, branch development)
  → túnel HTTPS → gateway com credencial própria de acesso
  → API Docker com segunda credencial → Better Auth + Neon development
```

A chave de cada salto autentica servidores; a sessão HttpOnly autentica o usuário. Uma não substitui a outra. A proteção Vercel permanece exigida. O gateway de diagnóstico e a Function GET existente não mudam de contrato.

Somente estas rotas são preparadas: login, sessão, saída, troca de senha, listagem/criação de usuários e bloqueio/reset administrativos da SPEC-007. Nenhum handler nativo Better Auth, proxy genérico, callback de marketplace ou rota de estoque foi aberto.

O IP usado no limitador vem da borda Vercel, é substituído na Function e só é aceito pela API depois de verificar a credencial do gateway. X-Forwarded-For enviado diretamente à API não concede confiança. Em local, o limitador continua usando o socket real.

## Variáveis e consumidores

Todos os valores reais continuam ausentes nesta entrega. Exemplos estão em `.env.example`. Não imprimir envs, config completa do Compose, headers ou cookies.

| Variável | Consumidor futuro | Regra |
| --- | --- | --- |
| PREVIEW_ACCESS_ENABLED | Function Preview | Padrão false; true somente na ativação autorizada |
| PREVIEW_ACCESS_ORIGIN | Function, gateway e API via override | Alias canônico exato de development, sem wildcard |
| PREVIEW_ACCESS_BRIDGE_ORIGIN | Function | URL HTTPS atual do túnel do gateway, não API/Vite |
| PREVIEW_ACCESS_BRIDGE_KEY | Function + gateway | Chave exclusiva, 32 bytes aleatórios ou mais; diferente da ponte de diagnóstico |
| PREVIEW_ACCESS_API_KEY | Gateway + API (AUTH_API_KEY) | Outra chave, diferente da anterior; nunca na Vercel/VITE_ |
| PREVIEW_AUTH_SECRET | API (AUTH_SECRET) | Segredo exclusivo da sessão, diferente das chaves de transporte |
| PREVIEW_AUTH_DATABASE_URL | API (DATABASE_URL e AUTH_DATABASE_URL) | Role fm_auth_preview_runtime, endpoint development confirmado, mesmo banco e sslmode=verify-full |
| VITE_AUTH_ENABLED | Build da web no Preview | true apenas depois de validar o backend; é pública, não é controle de segurança do servidor |

VERCEL_ENV e VERCEL_GIT_COMMIT_REF são metadados da plataforma; não falsificá-los para contornar ambiente. A Function não recebe conexão PostgreSQL, segredo de sessão ou chave da API. O gateway não recebe banco/Redis/segredo da sessão. O worker não recebe AUTH_* nesta fatia.

A API de acesso usa a role limitada nos dois pools (health e auth), sem carregar a conexão proprietária. A role do worker híbrido permanece sob a política anterior; sua redução de permissões e persistência de negócio pertencem à E02. Nenhuma dessas escolhas autoriza uso produtivo da stack de desenvolvimento.

## Isolamento e falhas

- Preview exige AUTH_CONTEXT=preview, APP_ENV=local, provider Neon/development e endpoint confirmado pelo validador existente. Production e configuração cruzada são recusadas.
- Cookies somente do namespace `__Secure-fm_preview_access`, Secure/HttpOnly/SameSite=Lax/Path=/ e sem Domain. Cookies de proteção Vercel não chegam ao backend. Set-Cookie múltiplo é preservado inclusive na renovação, rotação e saída.
- DTOs filtram tokens/campos extras. Respostas até 64 KiB; requisições JSON até 8 KiB; erros normalizados, no-store e sem redirects/Location. A chave interna não aparece em JSON ou logs.
- Rotas, método, query, IP, credencial ou origem inválidos são recusados antes de tráfego útil. Chamadas de acesso são limitadas a quatro simultâneas no gateway; limites de login continuam no Redis.
- Os comandos `auth-local.mjs` e `auth-generate.mjs` continuam **exclusivamente locais**. O helper próprio recusa Preview antes de criar Pool. Não remover essa proteção para migrar Neon.

## Ensaio executado

1. Testes RED da ponte e do contexto Preview observados antes da implementação, depois GREEN.
2. Unitários da Function/gateway cobrem opt-in, ambiente/branch/host, allowlist, método/query, origem, IP, corpos, DTOs e cookies. Gateway HTTP real preserva headers de cookies separados.
3. Integração percorre Function → gateway HTTP real → NestJS → PostgreSQL/Redis reais descartáveis. Contexto Preview é injetado somente no teste após validar configuração Docker local; o runtime não contém flag para aceitar banco fictício como Neon.
4. Login, renovação, troca de senha com rotação de cookie, perfil/pending, origem/cookie cruzado, limites por IP e logout/revogação foram exercitados. Correção no teste: após trocar senha, usar o novo cookie, pois a sessão antiga foi revogada corretamente.
5. Compose combinado validado com valores sintéticos, sem iniciar o override. Conferido isolamento das variáveis entre API/gateway/web/worker.
6. Revisão independente não encontrou P1/P2 concreto; revisão posterior confirmou role limitada e manutenção dos scripts locais.
7. Verificação final no Docker: lint/typecheck, 66 testes regulares e build passaram; integração local 13/13 e cadeia Preview descartável 8/8. Smoke 4773/4774 passou e o navegador anônimo continuou vendo somente login (sessão 401). Imagem de verificação: fasemarketplace-preview-access-verify, manifest list sha256:6387ba01b4b3b7e07b9cc821fce7c2e2bf8da88cf1423122cd4f9f9e73efa068.
8. Incidente do ensaio inicial: stack isolada estava parada; conexão falhou antes do login. Ela foi retomada sem reset de volumes e os testes passaram. Um teste também foi corrigido para usar o cookie rotacionado após troca de senha.

Os testes não comprovam roteamento real de catch-all, TLS/cookies no navegador da Vercel, permissões da role no Neon ou recuperação remota. Esses itens continuam no gate de homologação HTTPS.

## Repetir os checks locais

```powershell
docker build --target verify -t fasemarketplace-preview-access-verify .
```

Com PostgreSQL/Redis da stack isolada E01.1 e `.env.access-test` privado apontando ao mesmo banco descartável `fm_auth_test_*`, já migrado:

```powershell
# Executar em sequência: ambos usam o banco descartável e suas fixtures.
docker run --rm --network fasemarketplace-mvp-access_local --env-file .env.access-test fasemarketplace-preview-access-verify node --test apps/backend/test/access.integration.mjs
docker run --rm --network fasemarketplace-mvp-access_local --env-file .env.access-test fasemarketplace-preview-access-verify node --test apps/backend/test/access-preview.integration.mjs
```

Não apontar os testes para banco persistente ou Neon. Não executar os dois em paralelo. A stack local conserva portas 4773/4774; nenhuma porta Preview nova foi iniciada.

## Gate para a próxima entrega

Antes de habilitar o novo override, ainda é necessário:

1. Ferramenta exclusiva de manutenção Preview preparada: [guia](preview-access-maintenance.md). Falta homologar permissões/execução no Neon após os demais gates. Comandos locais continuam restritos; owner direto fica fora do runtime.
2. Backup real development e restore Docker 18 concluídos em 25/10/2026: [evidência](neon-development-recovery-2026-10-25.md). Origem public vazia, baseline anterior à migration; conteúdo auth coberto por fixtures 17/18. Usuário decidiu guarda somente local por enquanto, adiando guarda externa. Repetir backup atualizado antes de futura migration se o estado/tempo tiver mudado; não promover ensaio vazio a prova de recuperação de usuários reais.
3. Preparar rollback: desativar Function e caminho do gateway, sem apagar usuários/tabelas ou alterar Production; na reativação, revogar sessões ou rotacionar segredo de sessão de forma controlada.
4. Autorizar explicitamente publicação e migration em Neon development; depois conferir Deployment Protection, cadastrar variáveis só em Preview/development e publicar a revisão revisada.
5. Somente então aplicar `compose.preview-access.yaml` junto dos dois Composes híbrido/Preview, após rebuild das imagens. Não copiar esse override para Production. Ativar o frontend só quando o backend estiver validado.
6. Homologar HTTPS real em Chromium e outro navegador disponível: login/reload/renovação/logout, dois perfis, pending/reset/bloqueio e limites; confirmar commit/deployment/destino efetivos e aceite humano.

Até concluir esses passos, o login publicado continua desativado e a interface remota permanece protótipo. E01.2 não está marcada como homologada remotamente.
