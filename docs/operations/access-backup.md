# Backup criptografado e restauração isolada

[SPEC-009](../specs/SPEC-009-access-backup.md) prepara a recuperação do acesso antes da ativação de Preview. Implementação/ensaio somente local e sintético; não executar comandos Neon sem autorização própria e confirmação do destino. Não há agendamento, publicação, exclusão automática ou escrita de negócio remota nesta entrega.

## O que o arquivo contém

Um `.fmbackup` novo contém dump custom de `public` e `business` quando existentes (payload v2), origem, versão e fingerprints SHA-256 por schema/tabela, todos protegidos por AES-256-GCM. Arquivos v1 continuam restauráveis como public-only. O dump e os fingerprints das tabelas usam o mesmo snapshot PostgreSQL; sequences seguem a semântica própria do pg_dump e podem apresentar lacunas de alocação. Não alterar DDL/sequences durante backup. Não há dump aberto em disco; a autenticação GCM termina antes de JSON/pg_restore ou conexão ao destino. [PostgreSQL — snapshot](https://www.postgresql.org/docs/17/app-pgdump.html) e [Node — authenticated decryption](https://nodejs.org/docs/latest-v24.x/api/crypto.html#deciphersetauthtagbuffer-encoding).

Escopo atual: tabelas comuns, índices e sequences de `public`/`business`, até 100 tabelas, 32 MiB de dados textuais totais/dump e 64 MiB de envelope. Outros tipos de relação (views, partições etc.) causam recusa; revisar a spec antes de ampliar o esquema. Não inclui roles globais, outros schemas, Redis, arquivos nem configuração de plataformas. A conta proprietária precisa de leitura completa; não aceitar backup parcial por falta de permissão. Cliente, origem e destino precisam da mesma major, 17 ou 18; outra versão ou cruzamento causa recusa antes de criar destino, sem upgrade automático. [Operação Prisma e backup local de negócio](business-persistence.md).

Arquivos são criados com exclusividade e modo 0600 no filesystem que o suporte. Arquivo existente nunca é sobrescrito. Falha de backup pode deixar arquivo vazio/incompleto no caminho reservado; ele não é backup válido e o restore o recusa. Use outro nome e investigue a falha. Erros de clientes PostgreSQL são descartados para evitar detalhes de conexão em logs; a CLI retorna erro genérico e código diferente de zero.

## Chave privada

Modelo: [access-backup-key.env.example](../../config/access-backup-key.env.example). Arquivo privado local sugerido: `.env.access-backup-key`, contendo somente `ACCESS_BACKUP_KEY=` seguido de 64 caracteres hexadecimais aleatórios (32 bytes). Nunca usar a senha do banco ou os segredos de sessão/transporte. Não mandar chave pelo chat, argumentos de comando, logs, VITE_, Vercel, worker ou Compose da aplicação.

Para criar uma chave nova **somente se o arquivo ainda não existir**, sem imprimir o valor:

```powershell
node --input-type=module -e 'import {writeFileSync} from "node:fs"; import {randomBytes} from "node:crypto"; writeFileSync(".env.access-backup-key", "ACCESS_BACKUP_KEY="+randomBytes(32).toString("hex")+"\n", {flag:"wx",mode:0o600});'
```

Esta execução já criou uma chave **de ensaio local**, ignorada, separada dos arquivos em backups/. Não substituir essa chave se quiser abrir os artefatos existentes. Para Preview usar outra chave privada, identificada pelo responsável; manter a chave anterior enquanto houver cópias que dependam dela. Guardar cópia segura da chave fora da máquina e separada dos backups antes de depender de recuperação remota. Ter dois arquivos no mesmo computador não protege contra perda da máquina; ACLs do Windows e guarda externa ainda precisam de configuração operacional.

## Preparar a imagem

```powershell
docker build --target access-maintenance -t fasemarketplace-access-backup-verify .
New-Item -ItemType Directory -Path backups/access-backup-rehearsal -Force | Out-Null
```

Somente esse target de manutenção tem pg_dump/pg_restore. API/worker e imagem Production não os recebem. A chave, envs e diretório backups não entram no build.

## Ensaio automático local

Pré-requisitos: stack isolada fasemarketplace-mvp-access saudável, `.env.access-test` já configurado para PostgreSQL Docker e fixture `fm_auth_test_*`, mais a chave privada de ensaio. O teste cria novas fixtures; nunca apontar ao Neon ou banco de uso da aplicação.

```powershell
docker run --rm --network fasemarketplace-mvp-access_local --env-file .env.access-test --env-file .env.access-backup-key -e ACCESS_BACKUP_TEST_DIRECTORY=/backups -v "${PWD}/backups/access-backup-rehearsal:/backups" fasemarketplace-access-backup-verify node --test apps/backend/test/access-backup.integration.mjs
```

Também é possível usar a CLI no banco descartável já existente:

```powershell
docker run --rm --network fasemarketplace-mvp-access_local --env-file .env.access-test --env-file .env.access-backup-key -v "${PWD}/backups/access-backup-rehearsal:/backups" fasemarketplace-access-backup-verify node scripts/auth-backup.mjs local-test /backups/manual-local-001.fmbackup
docker run --rm --network fasemarketplace-mvp-access_local --env-file .env.access-test --env-file .env.access-backup-key -v "${PWD}/backups/access-backup-rehearsal:/backups:ro" fasemarketplace-access-backup-verify node scripts/auth-backup.mjs restore-local /backups/manual-local-001.fmbackup
```

O restore valida configuração local, autentica o arquivo inteiro e só então conecta/cria `fm_auth_restore_<aleatório>`. Não aceita nome de destino. Remove apenas o public vazio daquele banco recém-criado, sem CASCADE, para o dump recriá-lo; nunca usa --clean ou DROP DATABASE. Falha deixa o banco novo isolado para investigação. Não há promoção automática, grants de runtime ou configuração da aplicação para usá-lo.

Após restaurar em transação única, compara todas as tabelas com seus fingerprints do snapshot. Em seguida apaga auth_session/auth_verification no banco novo, confirma que ficaram vazias e que os demais dados não mudaram. Identidades, hashes de senha, perfil, pending e bloqueio permanecem. Isso não desbloqueia usuário nem muda senha. Tokens/sessões da origem continuam intactos.

## Futuro backup Preview — não executado nesta entrega

Antes: autorizar acesso remoto específico, confirmar projeto/branch/endpoint/banco, verificar `.env.preview-access-maintenance` conforme [manutenção](preview-access-maintenance.md), prover chave **Preview** própria e destino privado de cópias, definir responsável/retenção/RPO/RTO. O arquivo de manutenção é lido somente pelo container efêmero; não aplicar seu conteúdo ao Compose/API.

```powershell
# Somente depois da autorização; arquivo de chave abaixo é exclusivo de Preview.
docker run --rm --env-file .env.preview-access-maintenance --env-file .env.preview-access-backup-key -v "${PWD}/backups/preview:/backups" fasemarketplace-access-backup-verify node scripts/auth-backup.mjs preview /backups/before-auth-001.fmbackup
```

Criar o diretório privado explicitamente antes do comando. Para ensaiar esse arquivo, usar `restore-local`, configuração Docker descartável e a mesma chave **do arquivo Preview**, nunca o env proprietário Neon no destino. Backup não habilita auth e não aplica migration. Homologar conteúdo/restore real do Neon antes da migration. Somente aceitar arquivos próprios, de origem e chave controladas: pg_restore executa SQL do dump; criptografia não torna confiável um arquivo fornecido por terceiros. [PostgreSQL — restore](https://www.postgresql.org/docs/17/app-pgrestore.html).

## Política e limites restantes

Política de desenvolvimento **aprovada pelo usuário em 24/10/2026**: cópia manual imediatamente antes de cada migração; guardar por pelo menos 30 dias e no mínimo 7 cópias, sem exclusão automática; meta de recuperação em até 1 hora. RPO limitado ao estado anterior à migração: alterações entre backups podem ser perdidas. Tempo medido em fixture pequena não é garantia de RTO do ambiente real. Nenhuma política de Production é definida por esta decisão.

Ainda faltam responsável, destino/guarda externa da chave e dos arquivos, backup/restore do alvo Neon confirmado e autorização de migration/publicação. Scripts locais de restore não escrevem no Neon. Ativação remota/Production permanece fora desta entrega.

### Decisão posterior — 25/10/2026

O usuário escolheu **manter cópias somente locais por enquanto**. Guarda externa foi adiada explicitamente; não criar storage nem transferir arquivos/chaves automaticamente. Chave continua em arquivo privado separado de backups/. A recuperação fica limitada à disponibilidade deste computador e desses arquivos; o ensaio não protege contra perda da máquina.

Auditoria pela API Neon confirmou PostgreSQL **18** no development. A adaptação com cliente e recuperação 18 separados foi concluída, e o primeiro backup real foi restaurado somente no Docker 18: [evidência e comandos específicos](neon-development-recovery-2026-10-25.md). **Não executar o cliente 17 contra esse alvo**, nem alterar stack/volumes 17 para essa finalidade. Os exemplos genéricos anteriores de backup Preview devem usar `fasemarketplace-access-backup18-verify` para esse projeto; detalhes no guia específico. A execução de 25/10 não autoriza novas migrations/publicações.

## Evidências do ensaio local — 24/10/2026

Docker passou lint/typecheck/build, 71 testes regulares e 35 de integração em sequência (13 local, 8 ponte Preview, 8 manutenção, 6 backup). Smoke dos cinco serviços e git diff --check passaram. Ensaio de backup incluiu escrita concorrente, rejeição de chave errada/arquivo adulterado/versão desconhecida sem criar destino, arquivo existente intacto, banco vazio pré-auth e comparação de usuários/hashes/perfis/pending/bloqueio antes/depois da revogação.

CLI também executada: backup próprio de 5 tabelas, 15685 bytes, restore novo fm_auth_restore_bbe78e92b39a24379ac8afc9, fingerprints conferidos e sessões/verificações zeradas. Artefatos criptografados e evidência JSON ficam em backups/access-backup-rehearsal/, ignorados. Chave de ensaio privada em arquivo separado. Revisão independente sem P1/P2 concreto. O primeiro restore falhou pelo schema public já existente no banco recém-criado; a correção restrita ao banco novo foi revalidada em banco cheio e vazio. Nenhuma dessas evidências representa recuperação remota Neon ou teste de Production.
