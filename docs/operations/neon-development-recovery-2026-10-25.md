# Recuperação do baseline Neon development — 25/10/2026

## Resultado

Backup real criptografado de development criado e restaurado em PostgreSQL 18 local independente. Origem permaneceu somente leitura; nenhuma migration, role/usuário remoto, publicação ou alteração Vercel/Production realizada. Usuário escolheu armazenamento **somente local por enquanto**, adiando guarda externa.

API Neon confirmou projeto autumn-shadow-97219766, branch br-fancy-waterfall-b6tbiwl1 (development), endpoint ep-soft-bird-b61xykn1 e PostgreSQL 18. Conexão proprietária existente conferida sem imprimir segredos; owner direto, TLS verify-full, banco neondb. Preflight SQL em BEGIN READ ONLY confirmou banco, role, major e TLS do cliente com certificado autorizado. `pg_stat_ssl` no backend retornou false por terminação no proxy; a checagem correta foi feita no socket TLS cliente, sem reduzir verificação de certificado.

Leitura adicional confirmou role fm_auth_preview_runtime ainda ausente e flags do owner para CREATE ROLE/CREATE no public. Nenhuma dessas consultas criou role, tabela ou usuário.

O schema public contém **zero tabelas**. Esse backup protege o estado pré-migration; não prova recuperação de usuários reais já existentes. Usuários, hashes, perfis, pending, bloqueio, sessões e tokens foram validados em fixtures sintéticas com PostgreSQL 17 e 18.

## Arquivo e evidências privadas

- Arquivo: backups/preview/development-pre-auth-20261025-19db3a1bd85141a894e4e5107d12c9a1.fmbackup, 1717 bytes.
- SHA-256: 7c78804f19def9b7102c1366cb9b13a7964ca1829f322b7f40afea787359e1b7.
- Chave Preview própria: .env.preview-access-backup-key, ignorada e fora de backups/. Não copiar a chave para Git/chat/navegador/imagem ou substituir enquanto houver cópias dependentes.
- Registro: mesmo nome do arquivo com sufixo .verification.json em backups/preview/; sem credenciais. Target-2026-10-25.json registra o destino conferido.
- Backup observado: 4,033 s; restore: 1,080 s. Valores de baseline vazio, sem garantia de RTO para dados/ambiente maiores.
- Destino novo: fm_auth_restore_8aecb533588621c0d8d950d1, projeto Docker fasemarketplace-recovery18. Fingerprints conferidos; nenhum dado permanente alterado no restore. Como não há tabelas auth no baseline, não existiam sessões/verificações a revogar; mecanismo foi exercitado com fixtures.

Guarda local depende da disponibilidade da máquina e dos arquivos; não representa recuperação após perda do computador. Política aprovada: manual antes de migration, retenção mínima 30 dias/7 cópias, sem exclusão automática, meta RTO 1h/RPO anterior à migration, com perda possível entre cópias. Não criar cópias idênticas artificiais só para contar sete; histórico cresce conforme backups válidos forem feitos.

## Ferramentas e isolamento

`access-maintenance` e imagem fasemarketplace-access-backup-verify mantêm cliente 17. `access-maintenance18` e imagem fasemarketplace-access-backup18-verify usam cliente 18. Nenhuma das imagens API/worker/Production herda clientes de backup.

Compose recovery18 independente, imagem postgres:18-alpine fixada no digest sha256:898c60cb390d1085bc97bdd6a1ae968757421df394b071848b52b1c09c89d6a5, volume fasemarketplace-recovery18_recovery18_data montado em /var/lib/postgresql conforme layout oficial 18, rede interna fasemarketplace-recovery18_recovery, sem portas publicadas. Sem reutilizar volume 17. [Imagem oficial PostgreSQL](https://hub.docker.com/_/postgres).

Arquivo .env.access-recovery18 contém somente credenciais locais novas e contexto de teste; modelo em [config/access-recovery18.env.example](../../config/access-recovery18.env.example). Não importar o env Neon nesta stack. AUTH_DATABASE_URL desse arquivo é apenas declaração para validação local do comando; não habilita uma API nem cria a role runtime.

```powershell
docker build --target access-maintenance18 -t fasemarketplace-access-backup18-verify .
docker compose --env-file .env.access-recovery18 -p fasemarketplace-recovery18 -f compose.recovery18.yaml up -d --wait --wait-timeout 180
```

Para repetir ensaio **sintético**, com chave de teste local:

```powershell
New-Item -ItemType Directory -Path backups/recovery18-synthetic -Force | Out-Null
docker run --rm --network fasemarketplace-recovery18_recovery --env-file .env.access-recovery18 --env-file .env.access-backup-key -e ACCESS_BACKUP_TEST_DIRECTORY=/backups -v "${PWD}/backups/recovery18-synthetic:/backups" fasemarketplace-access-backup18-verify node --test apps/backend/test/access-backup.integration.mjs
```

Para repetir o restore **do arquivo Neon já obtido**, usar chave Preview e env de destino local; nunca o env proprietário Neon:

```powershell
docker run --rm --network fasemarketplace-recovery18_recovery --env-file .env.access-recovery18 --env-file .env.preview-access-backup-key -v "${PWD}/backups/preview:/backups:ro" fasemarketplace-access-backup18-verify node scripts/auth-backup.mjs restore-local /backups/development-pre-auth-20261025-19db3a1bd85141a894e4e5107d12c9a1.fmbackup
```

Cada execução cria outro banco novo, sem DROP DATABASE/--clean. Sem limpeza automática de bancos/volumes. A cópia restaurada permanece isolada; não configurar a aplicação para usá-la.

## Validação e limitações

72 testes regulares, lint/typecheck/build no Docker passaram. Backup/restore real sintético: 7/7 em 17 e 7/7 em 18, incluindo escrita concorrente, envelope alterado/chave errada/versão desconhecida e recusa de majors diferentes antes de criar destino. Stack de recuperação healthy, sem PortBindings, rede Internal=true; smoke dos cinco serviços locais 17 passou. Revisão independente sem P1/P2 concreto.

O primeiro comando inline de preflight falhou por quoting antes de conectar; substituído por script temporário. Checagem inicial de TLS do backend foi corrigida para verificar o socket cliente após diagnóstico, mantendo verify-full e certificado autorizado. Nenhum desses ensaios aplicou escrita remota.

Próximo gate: autorização específica para aplicar migration de acesso e criar role limitada em development; depois bootstrap privado do administrador, validação de permissões e publicação/ativação de Preview somente quando autorizadas. Conexões e chaves previstas estão em .env.preview-access-maintenance, ignorado, mas ainda não aplicadas. A role fm_auth_preview_runtime e as tabelas auth **não foram criadas no Neon**. Production continua fora desta entrega.
