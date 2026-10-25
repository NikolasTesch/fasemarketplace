# Login e administração de acesso no Docker local

SPEC-007 aprovada e implementada originalmente na branch `codex/local-access`. A integração com o frontend homologado está agora em `codex/mvp-access-integration`, conforme [execução E01.1](mvp-access-integration-2026-10-24.md). Funciona no Compose padrão, com PostgreSQL e Redis locais. Esta autenticação não foi publicada; o Preview mantém o protótipo e a ponte de diagnóstico.

## Configuração privada

O `.env` desta máquina já foi preparado. Em outro checkout, preserve o arquivo existente e preencha somente a seção AUTH de `.env.example`:

| Variável | Valor local |
| --- | --- |
| AUTH_ENABLED | `true`, opt-in exclusivo do Compose padrão |
| AUTH_SECRET | segredo aleatório exclusivo, pelo menos 32 bytes; 64 caracteres hexadecimais |
| AUTH_DATABASE_URL | `postgresql://fm_auth_runtime:SENHA_PRIVADA@postgres:5432/fasemarketplace`; mesmo banco de DATABASE_URL, role diferente |
| AUTH_ORIGIN | `http://127.0.0.1:4173`, exatamente a origem aberta no navegador |
| AUTH_COOKIE_PREFIX | `fm_local_access`; outro checkout precisa de prefixo e segredo próprios |

Gere valores aleatórios no terminal privado, por exemplo com `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` no PowerShell 7, uma vez para o segredo e outra para a senha runtime. Não use o mesmo valor nem copie credenciais para chat, logs ou Git. Uma senha hexadecimal não precisa de escape na URL. Não edite credenciais Neon, POSTGRES_* ou DATABASE_URL de um volume existente para configurar auth.

A migration cria `fm_auth_runtime` se ausente, com a senha informada em AUTH_DATABASE_URL. Se a role já existir, não altera sua senha nem amplia privilégios. A role recebe somente SELECT/INSERT/UPDATE/DELETE nas quatro tabelas auth; a conexão DATABASE_URL do proprietário executa DDL. O segredo e essa URL não são injetados no worker ou na web; a web recebe apenas VITE_AUTH_ENABLED. Não preencher AUTH_* na Vercel.

## Preparação e execução

Antes da primeira migration em um banco persistente, faça um pg_dump custom e teste o restore em outro banco local descartável. Nunca restaure sobre o original. O ensaio desta entrega está registrado abaixo; não repita exclusão de volumes ou resets para instalar autenticação.

Execute na raiz, usando somente o Compose padrão:

```powershell
docker compose build api
docker compose run --rm --no-deps -T api npm run auth:migrate
# Reaplicar verifica checksum e preserva os dados.
docker compose run --rm --no-deps -T api npm run auth:migrate
docker compose up -d --no-build --wait --wait-timeout 180
pwsh -NoProfile -File scripts/verify-local.ps1
```

A API não executa migrations automaticamente. O schema `001_auth.sql` foi gerado usando Better Auth 1.7.12; não edite uma migration já aplicada. Atualizações futuras exigem outra migration e validação da versão. O gerador de manutenção `scripts/auth-generate.mjs` recusa bancos sem prefixo descartável `fm_auth_test_`; não é necessário para iniciar a aplicação.

## Criar o primeiro administrador

Não existe usuário ou senha padrão no banco persistente. Execute em um terminal interativo:

```powershell
docker compose run --rm --no-deps api npm run auth:bootstrap
```

Informe nome, e-mail e uma senha de 12 a 128 caracteres. A senha não é exibida nem passada como argumento. O comando recusa execução quando já existe administrador, inclusive duas execuções concorrentes. Não use `-T` no modo interativo. `--stdin` existe para testes automatizados com entrada privada, sem colocar credenciais na linha de comando.

Abra [a interface local](http://127.0.0.1:4173) usando `127.0.0.1`, conforme AUTH_ORIGIN. Faça login e abra **Usuários** para criar os demais acessos. Usuários criados recebem senha provisória e precisam trocá-la antes de continuar. Entregue a senha por canal privado fora do sistema. Não há envio de e-mail ou recuperação automática nesta entrega.

O administrador pode bloquear/desbloquear e redefinir senhas de outras pessoas. Bloqueio e redefinição revogam sessões. Troca da própria senha encerra as outras sessões. Autobloqueio é recusado e deve permanecer um administrador ativo. Uma senha esquecida pelo único administrador ainda exige um procedimento de recuperação a especificar; não oferecemos atalho HTTP de bootstrap ou reset.

## Segurança e limites

- Sessões no PostgreSQL, cookies HttpOnly/host-only/SameSite=Lax, oito horas e renovação a partir de uma hora. HTTP sem Secure somente em loopback. Tokens não são devolvidos em JSON nem gravados em storage do navegador.
- Rotas NestJS `/access/*` são acessadas pela web através de `/api/access/*`. Cadastro público e handler nativo Better Auth não são montados. Guards e serviços conferem sessão, perfil, bloqueio e troca pendente.
- Mutação exige Origin exato e JSON até 8 KiB. Login reserva tentativa atomicamente no Redis: cinco falhas por IP/e-mail e vinte por IP em quinze minutos. IP real do socket; identificadores protegidos por HMAC e namespace por cookie. Redis indisponível recusa login. Tráfego local do Vite compartilha o IP do proxy, limite adequado apenas ao piloto local.
- Login, bootstrap e mutações que revogam sessões são serializados pelo lock PostgreSQL 734007, evitando login com senha antiga após redefinição. Essa estratégia simples prioriza correção no piloto; não representa dimensionamento para alta concorrência.
- Nenhum payload de autenticação, identidade, cookie ou erro bruto é enviado ao PostHog. Autenticação remota, SMTP, MFA, auditoria de domínio e perfis de negócio exigem próximas specs.

Better Auth está fixado em 1.7.12. O override de multer 2.5.0 corrige a dependência 2.4.0 do NestJS 12.2.0, conforme [advisory GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m). Instalação limpa deve manter `npm audit` sem vulnerabilidades conhecidas; isso não substitui revisão.

## Validação desta entrega

Evidências de 23/10/2026:

- Backup custom `backups/local-before-access-20261023205933.dump`, ignorado pelo Git. Restore ensaiado em `fm_auth_restore_26a995c6d7`; original e restore tinham zero tabelas públicas antes de auth. Nenhum volume removido.
- Integração usa exclusivamente banco descartável `fm_auth_test_adc3862f3d`, segredo/prefixo próprios e credenciais sintéticas. O teste recusa nomes sem prefixo antes de limpar suas fixtures. Não apontar esse teste para banco persistente.
- `apps/backend/test/access.integration.mjs` cobre login, sessão/expiração/logout, cadastro fechado, CSRF, limites de JSON, DTO, duplicidade, privilégios, senha provisória, bloqueio/reset, revogação, bootstrap concorrente, corrida login/reset e Redis.
- Migration aplicada e reaplicada no banco persistente local; checksum conferido. Runtime: DML permitido, CREATE no schema recusado e leitura de auth_migration recusada. Zero usuários no banco persistente após os testes.
- Docker verify passou: lint, typecheck, 56 testes regulares e build. Mais 13 testes de integração passaram com PostgreSQL/Redis reais, incluindo o teste concorrente reproduzido antes da correção. Instalação limpa: zero vulnerabilidades no audit.
- Chromium: criação administrativa, login, troca obrigatória, usuário comum sem administração, sessão após recarga, bloqueio/desbloqueio/reset, logout e layout a 390 px passaram. Cookie HttpOnly/SameSite e ausência de storage de auth conferidos. Capturas somente de dados sintéticos em backups/access-*.png, fora do Git.
- Entrada interativa do bootstrap conferida em TTY com senha sintética: senha não exibida e repetição recusada. A interface permanente em 4173 renderizou login e recusou sessão anônima com 401.
- Revisão independente encontrou corrida login/reset; corrigida e revisada, sem P1/P2 restante. Containers/rede temporários do navegador foram removidos, preservando volumes.
- Smoke local, híbrido e Production Docker passaram; readiness pública de Production continuou `ready`. Inspeção de env confirmou segredo somente na API local, flag pública na web e nenhum AUTH_* nos backends híbrido/produtivo. Sem deploy, migration Neon, commit ou push.

Para verificar as validações que não precisam de fixtures reais:

```powershell
docker build --target verify -t fasemarketplace-local-verify .
```

O teste de integração é separado do `npm test`, pois exige um PostgreSQL descartável previamente migrado e Redis. Use somente um arquivo privado de teste com DATABASE_URL e AUTH_DATABASE_URL apontando para o mesmo `fm_auth_test_*`, segredo próprio e AUTH_COOKIE_PREFIX `fm_access_test`. O nome distinto do banco não basta: confirme a rede Docker local e as URLs antes de executar. Não há migration ou seed no Neon nesta entrega.

Depois de preparar exclusivamente esse banco descartável, a imagem de verificação contém o backend compilado e os testes:

```powershell
docker run --rm --network fasemarketplace-local_local --env-file .env.access-test fasemarketplace-local-verify node scripts/auth-local.mjs migrate
docker run --rm --network fasemarketplace-local_local --env-file .env.access-test fasemarketplace-local-verify node --test apps/backend/test/access.integration.mjs
```

Execute integração e smoke do navegador em sequência se compartilharem o banco descartável: a integração limpa suas fixtures e revoga suas sessões. As portas 4573/4574 e os containers temporários usados no ensaio já foram encerrados; a aplicação local permanente permanece em 4173/4174.
