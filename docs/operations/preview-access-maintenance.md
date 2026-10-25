# Manutenção privada do acesso Preview

Ferramenta preparada e ensaiada somente com PostgreSQL Docker descartável. Não executada no Neon; não habilita login remoto. [SPEC-008](../specs/SPEC-008-preview-access.md) e [preparação](preview-access-preparation.md) continuam sendo os gates.

**Atualização 25/10/2026:** operações remotas autorizadas/executadas e Preview homologado; [estado atual](preview-access-activation-2026-10-25.md). A descrição acima corresponde à preparação original. Não repetir bootstrap em banco já administrado; futuras migrations/resets/publicações exigem seu escopo autorizado.

## Destino e credenciais

Modelo: [preview-access-maintenance.env.example](../../config/preview-access-maintenance.env.example). Futuro arquivo privado: `.env.preview-access-maintenance`, ignorado por Git/Docker build. Não copiar `.env` local inteiro, senha genérica, credenciais produtivas nem chave proprietária para o runtime.

O comando valida configuração antes de criar Pool ou solicitar senha. A URL runtime é a mesma nos dois campos, role `fm_auth_preview_runtime`, endpoint pooled development confirmado, TLS verify-full. A URL proprietária tem o mesmo banco e endpoint direto correspondente, removendo somente `-pooler` do hostname. Confirmar ambos no painel Neon; não inventar outro projeto. O owner precisa conseguir criar role/tabelas; ausência de privilégios causa recusa, não elevação automática.

A conexão direta mantém o advisory lock 734007 durante a operação inteira, inclusive chamadas Better Auth em outro pool. A API usa lock transacional dentro de BEGIN/COMMIT/ROLLBACK para manter a afinidade no pooler, cuja [documentação não admite locks de sessão](https://neon.com/docs/connect/connection-pooling#connection-pooling-in-transaction-mode). Migração usa transação, checksum da 001 e grants explícitos de SELECT/INSERT/UPDATE/DELETE nas quatro tabelas auth. Runtime não pode ter flags administrativas, heranças de roles, propriedade de objetos públicos, CREATE no schema, acesso à tabela de controle ou TRUNCATE/REFERENCES/TRIGGER nas tabelas auth. Bootstrap/recover também conferem checksum e privilégios, recusando alterações posteriores às permissões. Role existente não tem senha trocada: senha divergente precisa de tratamento explícito. Senhas owner/runtime devem diferir. Privilégios efetivos no Neon ainda devem ser homologados.

## Execução futura, depois dos gates

**Não executar escritas remotas antes de autorização específica, backup do alvo confirmado e restore isolado validado.** Política de retenção/RPO/RTO de desenvolvimento aprovada na SPEC-009; responsável e guarda externa ainda precisam ser definidos. Os dumps sintéticos locais anteriores não atendem esse gate.

Preparar uma imagem de verificação contendo os scripts (a imagem Production não os inclui):

```powershell
docker build --target verify -t fasemarketplace-preview-maintenance-verify .
# Somente valida arquivo, sem conectar ao PostgreSQL ou escrever:
docker run --rm --env-file .env.preview-access-maintenance fasemarketplace-preview-maintenance-verify node scripts/auth-preview.mjs check
```

Após liberação de execução remota e comprovação de recuperação:

```powershell
docker run --rm --env-file .env.preview-access-maintenance fasemarketplace-preview-maintenance-verify node scripts/auth-preview.mjs migrate
docker run --rm -it --env-file .env.preview-access-maintenance fasemarketplace-preview-maintenance-verify node scripts/auth-preview.mjs bootstrap
# Somente para recuperar um administrador já existente:
docker run --rm -it --env-file .env.preview-access-maintenance fasemarketplace-preview-maintenance-verify node scripts/auth-preview.mjs recover
```

Bootstrap pede nome/e-mail/senha oculta e recusa quando já existe administrador. A conta criada precisa trocar a senha provisória no primeiro acesso. Não há conta padrão remota. `--stdin` aceita JSON privado de até 8 KiB para automação; nunca incluir senha nos argumentos, no histórico de shell ou em logs.

Recover exige e-mail de administrador existente. Mantém ID, perfil e bloqueio; não cria nem desbloqueia usuário. Marca pendência e revoga sessões antes de redefinir a senha; depois revoga novamente. Falha durante reset mantém a pendência/revogação já aplicadas. Para usuário bloqueado, a recuperação de senha não libera login. Responsável deve usar o fluxo administrativo de desbloqueio quando disponível, ou uma futura operação explicitamente especificada.

O reset usa `requestPasswordReset`/`resetPassword` do Better Auth 1.7.12. Callback privado mantém token somente na memória, sem enviar e-mail, imprimir token ou expor rota HTTP. Token residual é removido no finally. O comportamento foi confirmado na dependência instalada e na [documentação oficial](https://better-auth.com/docs/authentication/email-password#request-password-reset).

## Repetir o ensaio local

Arquivo `.env.access-test` deve apontar somente para o PostgreSQL `postgres` local e banco `fm_auth_test_*` já usado nos ensaios, nunca Neon. O teste cria outro banco `fm_auth_test_maintenance_*`, preserva-o para inspeção e não remove volumes/roles.

```powershell
docker run --rm --network fasemarketplace-mvp-access_local --env-file .env.access-test fasemarketplace-preview-maintenance-verify node --test apps/backend/test/access-maintenance.integration.mjs
```

Role sintética `fm_auth_preview_runtime` é exclusiva do PostgreSQL da stack de teste. Senha sintética no teste não é receita para Preview. O ensaio cobre migration repetida, checksum adulterado, DDL/TRUNCATE/tabela de controle negados, bootstrap duplicado, reset real, sessão antiga/senha anterior recusadas, pendência, ausência de tokens e bloqueio preservado.

Inclui recusa de privilégios ampliados depois da migration e coordenação observada em `pg_locks` entre lock transacional da API e manutenção direta. O teste usa PostgreSQL direto, não comprova execução no PgBouncer real do Neon.

## Rollback e limitações

Rollback operacional previsto: desativar opt-in da Function e caminho de acesso do gateway; manter diagnóstico e Production; não apagar tabelas/usuários. Revogação de sessões e rotação de segredo exigem operação autorizada no alvo correto. Não há down migration destrutiva automática.

Backup real development e restore em Docker 18 concluídos em 25/10/2026 para baseline public vazio: [evidência](neon-development-recovery-2026-10-25.md). Política de desenvolvimento aprovada, com guarda somente local escolhida pelo usuário. Operação remota de migration/bootstrap e validação efetiva de privilégios, publicação e homologação HTTPS continuam pendentes. Owner CREATE ROLE/CREATE public foi conferido por leitura; isso não equivale à migration aplicada nem à role runtime homologada. Não aplicar comandos reais sem autorização específica e backup atualizado do alvo.
