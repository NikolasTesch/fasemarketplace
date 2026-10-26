# Acesso do piloto no Preview — ativação de 25/10/2026

## Entrega autorizada

Usuário autorizou migration/role development, primeiro administrador e configuração/homologação Preview. Os quatro passos foram executados. Production/main não receberam esta funcionalidade.

URL: [Preview de development](https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app/). A proteção da Vercel continua exigida, além do login do produto. E-mail do administrador é o fornecido pelo usuário, mantido fora do repositório. Credenciais de entrega estão em `.env.preview-admin.json` privado/ignorado na raiz deste worktree; senha provisória aleatória exclusiva, com troca obrigatória no primeiro acesso. Após a troca, o valor provisório deixa de funcionar.

Não colocar esse arquivo em Git, Vercel, frontend ou no diretório de backups. Senhas de homologação foram invalidadas e o arquivo intermediário removido. O operador sintético de teste foi bloqueado e ficou com troca pendente; nenhuma conta de cadastro aberto foi habilitada. Criação de contas permanece restrita ao administrador.

## Banco e permissões

Neon: projeto autumn-shadow-97219766, branch br-fancy-waterfall-b6tbiwl1 (development), PostgreSQL 18, banco neondb. Endpoint conferido pela API e pela conexão direta/TLS. Novo backup pré-escrita criado e restaurado no Docker 18 antes da migration.

Migration 001 aplicada com checksum; reaplicação verificou histórico sem repetir DDL. Role fm_auth_preview_runtime com LOGIN/NOINHERIT e sem flags administrativas, memberships, propriedade de objetos ou CREATE no public. DML nas quatro tabelas auth. CREATE TABLE, TRUNCATE e acesso a auth_migration foram efetivamente negados; INSERT/SELECT/UPDATE/DELETE testados em transação revertida. API usa essa conexão limitada em ambos os pools; conexão proprietária fica na manutenção privada. Worker conserva política anterior da SPEC-004, sem chaves AUTH.

Estado de entrega conferido: um administrador com troca obrigatória, um usuário sintético bloqueado, zero sessões e zero verificações/reset tokens. Recuperação offline do administrador foi exercitada ao invalidar senhas/sessões dos testes e emitir nova senha provisória privada.

## Runtime e variáveis

Arquivo privado de execução: `.env.preview-access-runtime`, separado do `.env` local e do `.env.production`. Não sobrepor os envs entre stacks.

```powershell
docker compose --env-file .env.preview-access-runtime -p fasemarketplace-hybrid -f compose.hybrid.yaml -f compose.preview.yaml -f compose.preview-access.yaml --profile tunnel up -d --build --wait --wait-timeout 180
```

API/worker/web/gateway usam a stack híbrida e o Redis de development. O túnel alcança somente o gateway. Chaves de diagnóstico, Function→gateway e gateway→API são independentes. Owner, segredo de sessão e chave da API não são enviados à Vercel nem ao navegador. A web 4273 conserva origem local; o login desse contexto Preview foi homologado somente no alias canônico HTTPS. Para login inteiramente local continuar usando a stack E01.1 em 4773.

Vercel, somente target Preview e gitBranch=development: PREVIEW_ACCESS_ENABLED, PREVIEW_ACCESS_ORIGIN, PREVIEW_ACCESS_BRIDGE_ORIGIN, PREVIEW_ACCESS_BRIDGE_KEY e VITE_AUTH_ENABLED. PREVIEW_BRIDGE_ORIGIN do diagnóstico acompanha o mesmo túnel; sua chave continua separada. Valores Production e deployment produtivo foram comparados ao inventário anterior, sem mudança. Não criar VERCEL_ENV/VERCEL_GIT_COMMIT_REF manualmente: a publicação ocorreu por Git na branch real development.

## Homologação e publicação

- 74 testes regulares, lint/typecheck/build no Docker; revisão independente sem P1/P2.
- Integrações de acesso local 13/13, ponte 8/8 e manutenção 8/8; backup 7/7 em 17 e 7/7 em 18.
- Chromium real: login, pending, troca obrigatória, reload, identidade real, criação de usuário, perfil negado no servidor, bloqueio/revogação, desbloqueio, reset/pending, logout, mobile sem overflow, cookies Secure/HttpOnly/SameSite=Lax, localStorage/sessionStorage vazios e nenhum erro de renderização.
- Microsoft Edge real: login, reload, sessão, cookie seguro e saída com sessão antiga recusada.
- HTTPS real: renovação de sessão controlada confirmou novo cookie seguro/expiração; origem estrangeira e query extra recusadas; cinco logins inválidos retornaram 401 e o sexto 429. Vercel anônima continuou redirecionando à autenticação, sem desativar proteção. A automação usou credencial de bypass já existente e privada, restrita ao host durante os testes; não foi gerada nem ampliada permissão global.
- Node gateway/túnel: chamadas sem chave negadas, API direta recusada e diagnóstico autenticado disponível.

Código integrado por PRs [#8](https://github.com/NikolasTesch/fasemarketplace/pull/8), [#9](https://github.com/NikolasTesch/fasemarketplace/pull/9), [#10](https://github.com/NikolasTesch/fasemarketplace/pull/10) e [#11](https://github.com/NikolasTesch/fasemarketplace/pull/11). Commit funcional da homologação: da54cf11bff31a839fdc6bda4acbae088754cd46. Deployment que passou nos navegadores após atualizar o túnel: dpl_CXnKuphZonFNVAHtLJfhUGG2dxUt. Atualizações documentais posteriores não alteram esse código funcional; conferir alias/commit atual nos registros privados.

O zero-config Node Vercel não interpretou [...path] como catch-all completo: injetava ...path na query e só reconhecia um segmento. O diagnóstico temporário registrou somente tipos/booleanos de rota, sem valores, e foi removido. Correção final usa sete entradas explícitas e normaliza somente `id` único igual ao ID real nas duas ações administrativas. Queries extras/duplicadas/divergentes continuam recusadas. [Fonte primária do roteador Vercel](https://github.com/vercel/vercel/blob/c628be7835e03a965b93e9cf9e2bd5ac2acbf5eb/packages/fs-detectors/src/detect-builders.ts#L1165).

## Backups e evidências

Backup após ativação: cinco tabelas auth, arquivo criptografado de 14590 bytes, SHA-256 9e13e4a1d0a9db9c2b85226425afe5eb3bd05b964a9a7bb0db5b6a2cc354b326. Restore isolado fm_auth_restore_81fe54db427fc8844f2e5bd4 em PostgreSQL 18 verificou fingerprints e revogação de sessões/verificações na cópia. Origem preservada. Política de guarda permanece somente local conforme decisão do usuário; chave privada separada de backups/.

Registros ignorados em backups/preview/: activation-preflight-2026-10-25.json, activation-postflight-2026-10-25.json, activation-final-verification.json e browser/{homologation,edge-smoke,http-probes}.json. Screenshot autenticado também é privado. Não publicar arquivos com credenciais/cookies/configuração completa da plataforma.

## Disponibilidade, retomada e rollback

O Preview depende da máquina ligada, Docker e túnel conectados. Durante a entrega e após uma retomada, Cloudflare Quick Tunnel perdeu o registro (Tunnel not found/hostname sem DNS), produzindo 503 apesar do deployment Ready; foi necessário recriar a conexão. Portanto Ready não prova disponibilidade do backend.

Se ocorrer novamente, verificar os logs somente do túnel e reiniciar apenas esse serviço. Sua URL pode mudar:

```powershell
docker compose --env-file .env.preview-access-runtime -p fasemarketplace-hybrid -f compose.hybrid.yaml -f compose.preview.yaml -f compose.preview-access.yaml --profile tunnel restart preview-tunnel
```

Atualizar PREVIEW_BRIDGE_ORIGIN e PREVIEW_ACCESS_BRIDGE_ORIGIN no arquivo privado e na Vercel **Preview/development**; publicar novo Preview da mesma branch real. Conferir 401 do gateway sem chave, 401 da sessão anônima autorizada na borda e 200 do diagnóstico autenticado. Não regenerar chaves ou mudar Production apenas porque a URL mudou. Worker híbrido pode precisar de retomada própria após suspensão prolongada, sem tocar em filas/volumes de outros projetos.

Rollback de acesso: VITE_AUTH_ENABLED=false e PREVIEW_ACCESS_ENABLED=false somente Preview/development; retirar o override de acesso do gateway/API e publicar Preview novamente. Não apagar usuários/tabelas, resetar volumes ou promover main. Revogar sessões/rotacionar segredo somente em operação autorizada no development correto. Diagnóstico possui chave/flag independentes.

## Limites do aceite

Homologação técnica concluída; primeiro acesso/aceite visual humano continua com o usuário. Estoque, catálogo, pedidos e relatórios permanecem simulados. Não há convites por e-mail, reset público, integração real de marketplace nem auth de Production por esta entrega. Próxima unidade do plano MVP: E02, persistência de negócio e seus limites/migrations; não iniciar regras de catálogo/estoque sem spec própria.
