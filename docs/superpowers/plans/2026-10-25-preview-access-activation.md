# E01.2 — Ativação autorizada do acesso em Preview

Usuário autorizou os quatro passos em 25/10/2026: migration/role development, permissões, primeiro administrador e configuração/homologação Preview Vercel. Administrador com e-mail informado pelo usuário, mantido somente no arquivo privado; nome de apresentação adotado Administrador FaseSport. Senha exclusiva aleatória em arquivo privado, troca obrigatória. Nunca usar conta/senha genérica local.

Executar inline com executing-plans, verificações existentes e revisão independente. A autorização cobre as operações necessárias à publicação **Preview/development**, inclusive integração Git revisada se necessária ao deploy real da branch; não cobre main/Production. Preservar docs/stitch não relacionadas e checkout original.

## Tasks

- [ ] A0: conferir estado remoto/destino/proteção Vercel e refazer backup atual com restore isolado antes da escrita.
- [ ] A1: aplicar migration por CLI dedicada; conferir checksum/idempotência, runtime sem DDL/TRUNCATE/auth_migration e DML real sob rollback.
- [ ] A2: bootstrap privado do administrador fornecido, pending obrigatório; testar identidades separadas sem enviar credenciais ao chat.
- [ ] A3: configurar env privado do Compose híbrido/Preview, duas chaves novas/separadas, API limitada, rebuild e túnel de gateway; sem herdar owner no runtime.
- [ ] A4: revisão do conjunto, commit seletivo e publicação/integracão development; variáveis Vercel somente Preview/branch development, proteção preservada. Sem falsificar VERCEL_ENV/branch. Não promover main.
- [ ] A5: homologar HTTPS em navegador, login/pending/troca/reload/roles/admin/block/reset/logout/limites e proteção; diagnóstico continua; revogar fixtures e sessões de homologação; deixar administrador com senha provisória privada/troca obrigatória.
- [ ] A6: registrar commit/deployment/artefatos/evidências e limitações; confirmar Production preservada.

## Gates

Publicação somente com lint/typecheck/build/testes/revisão aprovados; erro de migration exige inventário do estado, sem retry cego/reset. Não registrar cookies/headers/config completa/chaves. Owner apenas manutenção; sem segredo em VITE_. Sem desativar proteção de Preview para facilitar testes. Guarda somente local já decidida pelo usuário.

## Ruling durante homologação

Deployment real da branch development revelou GET session 400, diferente do ensaio local da cadeia. O catch-all da plataforma inclui parâmetro reservado path, recusado pela query allowlist. Adapter específico da Function consome somente uma cópia exatamente igual ao sufixo real de pathname; não escolher destino pelo parâmetro, não relaxar queries no gateway/API. Regressão RED400/GREEN401 inclui POST/corpo, mismatch, duplicata e query extra. Verificação HTTPS real repetida depois de publicar a correção.
