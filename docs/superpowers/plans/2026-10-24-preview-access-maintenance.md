# E01.2 — Manutenção privada do acesso Preview

Execução inline autorizada pelo pedido de continuidade. Aplicar executing-plans e TDD. Nenhuma escrita Neon/publicação faz parte do ensaio.

## Contrato

Ferramenta própria, sem retirar a restrição dos comandos locais. Valida Preview/development, origem e runtime existentes antes de abrir Pool. Conexão proprietária somente no processo de manutenção, no endpoint **direto** correspondente ao endpoint pooled confirmado, mesmo banco, TLS verify-full e usuário diferente. O endpoint direto permite advisory lock de sessão sem depender de afinidade do pooler.

Migrate valida checksum, provisiona role sem privilégios administrativos/heranças e concede DML somente às quatro tabelas auth. Não troca senha de role existente. Bootstrap recusa administrador existente; recuperação afeta somente administrador existente, mantém bloqueio/identidade/perfil, impõe troca e revoga sessões. Reset utiliza APIs oficiais Better Auth, token somente em memória, sem e-mail nem endpoint HTTP novo.

## Tasks

- [x] M01 RED/GREEN: destino, owner direto e recusa de Production/local/config cruzada antes da conexão.
- [x] M02: migration idempotente/checksum/role limitada e bootstrap privado; integração contra PostgreSQL real descartável.
- [x] M03: recuperação offline, sessões antigas inválidas, senha anterior recusada, pending e bloqueio preservados; integração contra PostgreSQL real descartável.
- [x] M04: regressão Docker, revisão independente e guia de execução futura.

## Gates preservados

Backup criptografado/restore isolado e política RPO/RTO/retenção serão necessários antes da execução remota. Não apresentar estes comandos como liberação para migrar Neon. Sem commit/push/deploy/merge ou ativação do override.

## Ruling da revisão

API existente usava advisory lock de sessão via URL pooled, incompatível com transaction pooling Neon. Correção diretamente necessária à coordenação com a manutenção: transação explícita + pg_advisory_xact_lock, COMMIT/ROLLBACK e descarte da conexão se rollback falhar. Operações Better Auth continuam no pool separado, sem starvation. Teste RED confirmou a sequência antiga; regressão cobre sucesso/falha/liberação. Não adicionar opções de sessão ao startup do runtime pooled.

## Evidências — 24/10/2026

- Docker verify: lint/typecheck/build e 68 testes regulares passaram (telemetria 8, backend 45, pontes 15).
- Integrações sequenciais: local 13/13, cadeia Preview 8/8, manutenção 8/8; total 29. Fixtures exclusivamente Docker `fm_auth_test_*`, sem migração/conta remota.
- Ensaio de manutenção recusa grants posteriores ampliados e observa espera real em pg_locks até a transação da API terminar. Não simula nem homologa PgBouncer Neon.
- CLI check com configuração sintética retorna sem conexão; CLI migrate com APP_ENV production recusa sem imprimir credenciais.
- Revisão independente: limitação de lock na API identificada e corrigida com teste RED/GREEN. Revisão final encontrou comparação de senha sem normalizar percent-encoding; corrigida para comparar valores decodificados, com regressão RED/GREEN. Sem outros P1/P2 reportados.
- Nenhum commit/push/merge/deploy, alteração de env real ou operação Neon/Vercel. Backup criptografado/restore continuam como próxima unidade antes da liberação externa.
