# E01.2 — Ativação autorizada do acesso em Preview

Usuário autorizou os quatro passos em 25/10/2026: migration/role development, permissões, primeiro administrador e configuração/homologação Preview Vercel. Administrador com e-mail informado pelo usuário, mantido somente no arquivo privado; nome de apresentação adotado Administrador FaseSport. Senha exclusiva aleatória em arquivo privado, troca obrigatória. Nunca usar conta/senha genérica local.

Executar inline com executing-plans, verificações existentes e revisão independente. A autorização cobre as operações necessárias à publicação **Preview/development**, inclusive integração Git revisada se necessária ao deploy real da branch; não cobre main/Production. Preservar docs/stitch não relacionadas e checkout original.

## Tasks

- [x] A0: conferir estado remoto/destino/proteção Vercel e refazer backup atual com restore isolado antes da escrita.
- [x] A1: aplicar migration por CLI dedicada; conferir checksum/idempotência, runtime sem DDL/TRUNCATE/auth_migration e DML real sob rollback.
- [x] A2: bootstrap privado do administrador fornecido, pending obrigatório; testar identidades separadas sem enviar credenciais ao chat.
- [x] A3: configurar env privado do Compose híbrido/Preview, duas chaves novas/separadas, API limitada, rebuild e túnel de gateway; sem herdar owner no runtime.
- [x] A4: revisão do conjunto, commit seletivo e publicação/integracão development; variáveis Vercel somente Preview/branch development, proteção preservada. Sem falsificar VERCEL_ENV/branch. Não promover main.
- [x] A5: homologar HTTPS em navegador, login/pending/troca/reload/roles/admin/block/reset/logout/limites e proteção; diagnóstico continua; revogar fixtures e sessões de homologação; deixar administrador com senha provisória privada/troca obrigatória.
- [x] A6: registrar commit/deployment/artefatos/evidências e limitações; confirmar Production preservada.

## Gates

Publicação somente com lint/typecheck/build/testes/revisão aprovados; erro de migration exige inventário do estado, sem retry cego/reset. Não registrar cookies/headers/config completa/chaves. Owner apenas manutenção; sem segredo em VITE_. Sem desativar proteção de Preview para facilitar testes. Guarda somente local já decidida pelo usuário.

## Ruling durante homologação

Deployment real revelou GET session 400. Primeira hipótese de query path não resolveu: diagnóstico temporário sem valores/PII confirmou query literal **...path=session**. Fonte primária fs-detectors da Vercel mostrou que [...path] é interpretado como segmento único, não catch-all multissegmento. Correção final: sete arquivos explícitos, incluindo users/[id]/block|password, sem alterar URLs públicas; adapter normaliza somente id exato nessas duas rotas. Removido diagnóstico temporário. Gateway/API mantêm contrato estrito, inclusive queries desconhecidas. Regressão RED/GREEN cobre POST/corpo e ID dinâmico, divergência/duplicata/queries extras; homologar funções reais após novo deployment.

## Resultado

Quatro passos concluídos; [registro operacional](../../operations/preview-access-activation-2026-10-25.md). Chromium e Edge passaram; renovação/CSRF/queries/401→429/proteção verificados no HTTPS real. Admin final pending, fixture bloqueada, zero sessões/verificações. Backup após ativação com cinco tabelas foi restaurado no Docker 18. 74 testes regulares/lint/typecheck/build, 29 integrações auth e revisão independente aprovados. Production/main preservados. Túnel temporário precisou de nova URL após perda do registro; retomada documentada. Primeiro aceite humano permanece com o usuário.
