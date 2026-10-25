# Backup do acesso — plano de implementação

> Execução inline com superpowers:executing-plans e TDD. Sem implementadores delegados; revisão independente ao final.

**Goal:** preparar backup autenticado e comprovar restore local descartável.
**Architecture:** módulo de envelope criptográfico, módulo pg_dump/restore/fingerprints, CLI com validação do alvo antes de conectar e imagem de manutenção com cliente PostgreSQL 17.
**Tech Stack:** Node 24 crypto/child_process/fs, pg existente, PostgreSQL 17. Sem dependência npm nova.
**Spec:** docs/specs/SPEC-009-access-backup.md.

## Constraints

Sem Neon/Vercel/escritas remotas, envs reais preservados, sem DROP DATABASE/limpeza de dados existentes/commit/publicação. Até 32 MiB dump/64 MiB envelope; restore novo local somente. Não decidir política operacional silenciosamente.

## Tasks

- [x] B01: RED/GREEN de envelope AES-GCM, segredo independente, tamanho/formato e recusa de alteração/chave errada.
- [x] B02: implementar snapshot/fingerprints, subprocesso sem shell/URL em argv, dump em memória e arquivo exclusivo; imagem de manutenção.
- [x] B03: restore somente banco novo descartável, comparação de conteúdo e revogação de sessões/tokens; CLI local/Preview separadas.
- [x] B04: ensaio PostgreSQL real, regressão, revisão independente e runbook/env/evidências.

## Review focus

Rejeitar bytes não autenticados antes de qualquer escrita/pg_restore; não herdar PG* externos; não vazar senha em erro do cliente; preservar snapshot durante dump; restore inválido não cria banco; arquivo existente não sobrescrito; key não vai para dump/web/imagem/Git.

## Ruling

Limite de memória explícito é suficiente para auth do MVP e mantém o fluxo simples; acima do limite, falhar e planejar streaming autenticado em outra entrega. Política de retenção/RPO/RTO não bloqueia ensaio sintético, mas bloqueia ativação remota.

Primeiro ensaio de restore revelou CREATE SCHEMA public no dump versus schema vazio já presente no template0. Preparar somente o banco novo criado pela operação removendo seu public vazio sem CASCADE; qualquer objeto inesperado faz a operação recusar. Não usar --clean, DROP DATABASE ou alterar banco existente. Diagnóstico obtido em cópia temporária ignorada do módulo, somente com fixtures sintéticas; clientes da ferramenta continuam com erros sanitizados.

## Resultado — 24/10/2026

- Imagem `fasemarketplace-access-backup-verify`, target access-maintenance: lint/typecheck/build e 71 testes regulares (telemetria 8, backend 48, pontes 15) passaram. pg_dump/restore 17.11, libpq 18.6 no pacote Alpine; servidor PostgreSQL 17. Manifest list sha256:060d85eee53e93460f47e322c72ba7b2d553480498d10961c6ab660989ee9af4.
- Regressão sequencial em Docker: acesso local 13/13, cadeia Preview 8/8, manutenção 8/8 e backup 6/6, total 35. Sem execução paralela sobre a fixture compartilhada.
- Backup integra escrita concorrente durante snapshot/dump, integridade criptográfica, versão desconhecida, arquivo existente, recusa de SEQUENCE, origem vazia pré-auth e origem com usuários/hashes/perfis/bloqueio/pending/sessões/verificação. Alteração/chave errada não cria banco destino.
- CLI local-test + restore-local executadas com sucesso em artefato próprio, 5 tabelas, 15685 bytes. Restore novo fm_auth_restore_bbe78e92b39a24379ac8afc9, conteúdo verificado, sessões/verificações revogadas. Evidência privada em backups/access-backup-rehearsal/verification-2026-10-24.json; chave em arquivo privado separado, não no diretório de backups.
- Smoke local: cinco serviços saudáveis, portas isoladas e proxy web/API/PostgreSQL/Redis. git diff --check sem erro.
- Revisão independente estática, incluindo ajuste do schema e guia final: sem P1/P2 concreto; confirmação de execução permanece dada pelos testes, não pela revisão.
- Política de desenvolvimento aprovada pelo usuário durante esta execução: manual pré-migration, mínimo 30 dias/7 cópias, sem exclusão automática, RTO meta 1h e RPO pré-migration com perda possível entre cópias.
- Sem commit/push/merge/deploy, credenciais remotas preenchidas, escrita Neon/Vercel ou alteração em Production. Próximo gate: responsável/guarda externa e autorização para backup/restore do alvo development confirmado antes da migration/ativação Preview.
