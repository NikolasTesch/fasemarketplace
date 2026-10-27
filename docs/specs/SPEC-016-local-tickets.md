# SPEC-016 — Chamados locais de bugs e melhorias

**Data:** 27/10/2026. **Estado:** integrada ao código local; migrations precisam ser aplicadas explicitamente após backup/restore, conforme o guia de acesso local. Não publicada.

## Objetivo e comportamento

Permitir que usuários autenticados registrem e consultem relatos de bugs e melhorias dentro do workspace local. Cada chamado tem tipo, tela, título, descrição, autor obtido da sessão e data; imagem opcional PNG/JPEG/WebP até 5 MiB. Lista paginada e imagens não são armazenadas no navegador.

## Regras e segurança

- Rotas `/tickets` só são carregadas quando a autenticação local está habilitada e a configuração de acesso aceita o ambiente; nenhuma Function remota é ampliada.
- Consulta e criação exigem sessão válida; escrita exige a origem local configurada e recusa contexto cross-site.
- Autor é resolvido da sessão no backend. Campos desconhecidos, tipo/tela inválidos, texto fora dos limites e MIME que não corresponde à assinatura binária são recusados.
- Chamados e anexos são gravados em tabelas PostgreSQL locais. Criação e imagem compartilham uma transação; falha reverte ambos. Runtime não tem permissão de apagar imagens.
- Respostas e anexos usam `Cache-Control: no-store`; o servidor limita upload, campos e tamanho de cada campo.
- Migrations 002/003 preservam seus checksums; migration 004 amplia a lista de telas para catálogo, usuários e configurações. Nenhuma migration roda no startup.

## Operação

Antes de aplicar migrations, seguir [acesso local](../operations/local-access.md): backup criptografado validado e restauração isolada. Aplicar apenas com `scripts/tickets-local.mjs migrate` no Compose local autorizado. A configuração recusa alvos remotos e Production. Não aplicar migration automaticamente ao banco ativo durante a integração desta branch.

## Aceitação

1. Usuário autenticado lista chamados por data e paginação e envia bug/melhoria com ou sem imagem válida.
2. Imagens inválidas, payloads fora dos limites, tela/tipo desconhecidos, origem externa e sessão inválida são recusados.
3. Autor nunca vem do navegador; falha de persistência não deixa chamado ou imagem parcial.
4. A interface apresenta estados de carregamento, vazio, falha, paginação e modal acessível, com foco restaurado ao fechar.
5. Testes unitários e de integração locais, lint, typecheck e build passam. Neon, Preview, Production e APIs externas permanecem inalterados.
