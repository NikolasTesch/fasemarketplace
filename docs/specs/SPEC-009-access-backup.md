# SPEC-009 — Backup e ensaio de recuperação do acesso

**Atualização 26/10/2026:** a [SPEC-010](SPEC-010-business-persistence.md) amplia o payload para v2, cobrindo `public` + `business` e sequences, com identidade qualificada e leitura retrocompatível de v1. Revogação restrita a `public.auth_session`/`public.auth_verification`. CLI local de negócio separado e validado; restore continua exclusivo em novo banco Docker de quarentena. As descrições public-only abaixo registram o escopo original.

Preparação local autorizada pelo pedido de continuidade. Complementa SPEC-008 e E02; não autoriza conectar ao Neon, executar migration remota, publicar ou alterar Production.

## Comportamento

- Backup lógico do schema public com pg_dump da mesma major (17 ou 18) do servidor, consistente com fingerprints por tabela obtidos no mesmo snapshot exportado. Restore exige igualdade entre major autenticada no arquivo, servidor destino e cliente antes de CREATE DATABASE; recusar versões desconhecidas, incompatibilidade, dados acima do limite ou objetos fora do escopo suportado.
- Arquivo único AES-256-GCM, nonce aleatório, chave independente de 32 bytes no env privado. Metadados e dump criptografados; nenhum dump aberto ou senha em disco/argv/log. Criar arquivo exclusivo sem sobrescrever backup existente. Limite explícito para este MVP: dump até 32 MiB, envelope até 64 MiB e dados textuais por tabela até 32 MiB; excedentes exigem evolução do mecanismo, nunca truncamento.
- Validar integralmente autenticação/formato antes de conectar ao destino ou fornecer bytes ao pg_restore. Chave errada, arquivo alterado/truncado/oversized ou versão desconhecida falham sem criar banco.
- Restore somente PostgreSQL Docker local, com configuração local já validada e banco-base fm_auth_test_*. Criar automaticamente banco novo fm_auth_restore_* com nome aleatório. Sem destino fornecido pelo usuário, DROP DATABASE, reset, substituição de banco ou restore Neon/Production. Remover somente schema public vazio do banco recém-criado pela própria operação, sem CASCADE, para permitir CREATE SCHEMA contido no dump; nunca remover schema/banco preexistente do usuário.
- pg_restore sem owner/ACL, transação única e parada no erro. Conferir fingerprints de todas as tabelas antes de revogar sessões e verificações restauradas. Conferir novamente os dados permanentes e ausência de sessões/tokens. Banco permanece isolado para inspeção; não conectar a API a ele automaticamente.
- CLI de backup Preview reusa validação dedicada de maintenance/owner direto. CLI de ensaio local aceita somente fixtures descartáveis. Defaults de auth/Compose/Vercel não mudam.

## Aceite e erros

Testes de criptografia/tamper/tamanho/configuração, ensaio real pg_dump→criptografia→pg_restore com usuários/perfis/pending/bloqueio/hash/sessão/verificação sintéticos, fingerprints e sessões/tokens revogados. Provar que arquivo existente não é sobrescrito e backup inválido não cria banco. Erros sanitizados, chave nunca registrada nem incluída no artefato. Não executar SQL de arquivo de terceiro: somente arquivo próprio cuja chave seja controlada pelo responsável.

## Limites operacionais

Atualização em 25/10/2026: usuário optou por guarda somente local por enquanto; guarda externa adiada, sem provisionamento/transferência automática. Consulta API confirmou Neon development PostgreSQL 18. Compatibilidade 18 implementada e ensaiada em target/stack independentes; backup real development restaurado no Docker 18 conforme plano 2026-10-25-neon-development-recovery. Nenhum downgrade/upgrade da stack 17 ou restore entre majors está autorizado. Primeiro backup Neon tem zero tabelas public, portanto comprova apenas o baseline pré-migration; conteúdo de auth foi exercitado com fixtures sintéticas em 17 e 18.

Ensaio sintético não comprova recuperação de dados remotos existentes, offsite ou disponibilidade de máquina. Backup cobre public, não roles globais, objetos fora desse schema nem configuração Redis/Vercel. Chave e cópia precisam de guarda separada; perder a chave impede restore. Usuário aprovou em 24/10/2026: backup manual antes de cada migração, retenção mínima de 30 dias e no mínimo 7 cópias, sem exclusão automática; meta RTO até 1 hora, RPO limitado ao estado imediatamente anterior à migração (pode haver perda entre backups). Guarda externa adiada por decisão posterior do usuário; operação permanece manual/assistida e definição permanente do responsável continua pendente. Escrita remota de migration/publicação ainda exige autorização. Sem agendamento nesta entrega.
