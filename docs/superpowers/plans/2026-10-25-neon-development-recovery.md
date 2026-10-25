# Backup real development — preparação e compatibilidade PostgreSQL 18

Usuário solicitou próxima etapa e escolheu **somente cópias locais por enquanto** em 25/10/2026. Essa decisão adia guarda externa; não contratar/criar storage, copiar para nuvem ou exportar chaves sem nova decisão. Sem autorizar migrations, bootstrap remoto, publicação ou ativação Preview por inferência.

## Descoberta verificada nesta execução

- API Neon: projeto autumn-shadow-97219766, branch br-fancy-waterfall-b6tbiwl1, nome development; endpoint ep-soft-bird-b61xykn1, distinto de Production. PostgreSQL **18** confirmado no projeto.
- URL privada NEON_DATABASE_URL existente no checkout original corresponde ao endpoint development declarado, role neondb_owner, banco neondb, TLS verify-full. Não foi solicitada nem gerada outra credencial proprietária.
- Configuração privada preparada sem sobrescrever envs: .env.preview-access-maintenance e .env.preview-access-backup-key. Runtime URL/senha previstos, mas role ainda não criada. Arquivos não aplicados a containers/Vercel. Metadados sem segredos em backups/preview/target-2026-10-25.json.
- Docker Engine indisponível: pipe dockerDesktopLinuxEngine ausente. Solicitação para iniciar Docker enviada ao usuário; não reiniciar stacks existentes automaticamente.
- Ferramenta SPEC-009 validada até agora é estritamente PostgreSQL 17. Não tentar usá-la no Neon 18 nem restaurar dump 18 no PostgreSQL 17 existente.

## Menor adaptação necessária

Preservar cliente/stack local 17. Adicionar target de manutenção 18 e stack de recuperação 18 independente, sem portas publicadas, usando serviço interno postgres em rede/volume exclusivos. Backup aceita somente 17/18 explícitos; exige cliente da mesma major da origem. Restore valida major do archive e do destino antes de CREATE DATABASE. Nunca atualizar/reutilizar volume PostgreSQL 17.

## Tasks

- [x] Confirmar destino efetivo development pela API e comparar conexão existente, sem imprimir credenciais.
- [x] Preparar envs privados e chave Preview própria, somente locais e ignorados.
- [x] Registrar escolha de guarda somente local; guarda externa adiada pelo usuário.
- [x] Iniciar Engine e verificar disponibilidade das imagens/stack isolada.
- [x] RED/GREEN: metadata 17/18, cliente correspondente e recusa de restore entre majors antes de criar destino.
- [x] Preparar/testar recuperação 18 independente com dados sintéticos, incluindo pre-auth vazio, sem alterar stack 17.
- [x] Validar configuração privada com comando check e confirmar versão/identidade SQL em transação somente leitura.
- [x] Gerar backup criptografado do Neon development e restaurar somente no Docker 18 novo; conferir fingerprints e sessões/tokens.
- [x] Registrar hash, conteúdo verificado, tempos e limitações; revisão independente. Somente depois tratar autorização de migration/publicação em outra etapa.

## Situação

Concluído em 25/10/2026 após usuário iniciar Docker. Backup real development criptografado e restaurado somente no Docker 18; origem public sem tabelas. SQL remoto exclusivamente leitura, sem DDL/escrita de dados. Role runtime ausente, owner com flags CREATE ROLE e CREATE no public confirmadas por leitura; não confundir essa consulta com validação de migration já aplicada. Production e Vercel não alterados. Detalhes em [evidências e operação](../../operations/neon-development-recovery-2026-10-25.md).

72 testes regulares/lint/typecheck/build passaram; 7/7 backup em PostgreSQL 17 e 7/7 em 18; schema vazio, conteúdo auth sintético, snapshots com escrita concorrente e recusa cross-major cobertos. Smoke local saudável, recuperação 18 sem portas e com rede interna. Revisão independente sem P1/P2 concreto. Nenhum commit/push/merge/deploy. Próxima operação de migration exige autorização específica.
