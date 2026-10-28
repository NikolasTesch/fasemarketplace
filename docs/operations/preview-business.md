# Catálogo e estoque no Preview de development

O frontend de development usa as rotas explícitas do Preview, o gateway autenticado no Docker e o schema `business` do Neon development. Auth e business usam roles distintas; owner/migrator não são fornecidos à API ou Vercel. Production não usa esta configuração. Dados iniciais são sintéticos e não representam contagem operacional.

Antes de cada migration: confirmar o endpoint e banco de development, criar backup criptografado novo e validar restauração em PostgreSQL 18 de quarentena. A manutenção requer o env privado de acesso Preview e `.env.preview-business`; nunca publicar ou imprimir esses arquivos. Com os dois arquivos carregados, `node scripts/business-preview.mjs check` verifica o histórico e `node scripts/business-preview.mjs migrate` aplica as migrations. `provision` é idempotente somente com as mesmas credenciais e recusa ownership ou privilégios divergentes. Não resetar banco, schema ou volumes.

Para iniciar a aplicação, combinar `compose.hybrid.yaml`, `compose.preview.yaml`, `compose.preview-access.yaml` e `compose.preview-business.yaml` no projeto Docker `fasemarketplace-hybrid`, carregando os dois arquivos privados de runtime. O túnel é opt-in pelo perfil `tunnel`, encaminha apenas ao gateway e pode receber outra URL ao reiniciar. Essa URL deve ser verificada e atualizada nos dois campos de origem da ponte em Vercel Preview para development, seguida de novo deployment. A proteção de acesso da Vercel e o login do produto permanecem exigidos.

Backup pré-migration de 28/10/2026: `backups/preview/development-pre-business-20261028.fmbackup` no worktree de manutenção, 5 tabelas, SHA-256 `3889d4913c7f8dbe2a5bc9e809ccac3894337a756d5300dd95b339d55347e128`; restore conferido em `fm_auth_restore_5d332614d1f35d215be6e373`. Arquivos e chaves permanecem locais e ignorados pelo Git.

Backup após migrations e carga sintética: `backups/preview/development-post-business-20261028.fmbackup`, 11 tabelas, SHA-256 `c4fbe53071198dc6f6faf5988aab3d37ea585b15c61a900dfb5f2cecc579c1fe`; restore conferido em `fm_auth_restore_581fd4b3a92bf1da7de85c2f`.
