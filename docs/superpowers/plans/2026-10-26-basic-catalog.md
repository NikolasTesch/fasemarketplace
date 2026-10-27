# Catálogo básico — plano de implementação

> **Execução:** `superpowers:executing-plans` inline, com TDD, revisão independente final. Usuário aprovou SPEC-011 em 26/10/2026. Implementar após promover a base SPEC-010 para main. Sem publicação automática deste catálogo.

**Objetivo:** experimentar produtos, variantes e SKUs reais, persistidos no Docker local e protegidos pelo login existente.

**Arquitetura:** módulo NestJS catálogo reutiliza sessão/lock de acesso e Prisma; schema business isolado. React usa /api/catalog na mesma origem. Demais telas continuam demonstrativas.

**Stack:** React/Vite, NestJS/TypeScript, Prisma 7.10.1, PostgreSQL 17, Redis.

**Spec:** [SPEC-011](../../specs/SPEC-011-basic-catalog.md).

## Restrições e foco de revisão

- Só local opt-in com auth+business no mesmo banco; nenhum endpoint novo remoto ou migration Neon.
- Produtos/variantes usam UUID; SKU trim+maiúsculas único para sempre, sem edição/exclusão; autor vem da sessão.
- Admin escreve, usuário consulta; pendência/revogação/bloqueio não podem ser contornados (T2).
- Duplicidade normalizada/concorrente e falha parcial não criam produto órfão (T1/T2).
- Update exige versão; inatividade do produto não altera flags individuais (T2/T3).
- Campos desconhecidos, IDs inválidos, busca/paginação excessivas e HTML nunca viram mass assignment/XSS (T1/T3).
- Nenhum saldo fictício aparece como integrado; client gerado funciona sob bind read-only (T3/T4).

## T1 — Contratos e persistência

**Arquivos:** `apps/backend/src/catalog/config.ts`, `validation.ts`, `apps/backend/test/catalog.test.cjs`, `apps/backend/prisma/schema.prisma`, migration `202610270001_catalog`.

**Interfaces:** `readCatalogConfig(env): boolean`; `productInput(body)`, `productEdit(body)`, `variantInput(body, withVersion)`, `variantEdit(body)`, `catalogQuery(query)`, `catalogId(value)` validam/normalizam, sem conexão. Versão positiva; pageSize=20; 20 variantes/criação, 50/produto. Filtro status é do produto; variantes exibem também ativação efetiva.

- [x] Testes RED: opt-in sem auth/contexto incorreto/bancos distintos recusados; SKU/nomes/IDs/queries e campos desconhecidos.
- [x] Implementar validadores mínimos e obter GREEN.
- [x] Adicionar modelos catalogProduct/catalogVariant, gerar migration em alvo/shadow novo, revisar SQL; constraints de SKU/tamanho/versão e grants UPDATE por coluna, sem DELETE/auth.
- [x] Antes da aplicação local, criar backup criptografado e restore em quarentena. Confirmar reaplicação/checksum.

## T2 — API autenticada e invariantes reais

**Arquivos:** `catalog/service.ts`, `controller.ts`, `module.ts`, `access/module.ts` (exportar serviço existente), `app.module.ts`, `apps/backend/test/catalog.integration.mjs`.

**Interfaces:** `CatalogService.list(req, query)`, `create(req, body)`, `editProduct(req,id,body)`, `addVariant(req,id,body)`, `editVariant(req,id,body)`. `LocalAccessService.principal(req,false,admin)` é autoridade; escrita dentro de `access.exclusive` para serializar com bloqueio/reset.

- [x] Escrever teste HTTP RED em DB sintético novo com auth real e duas contas; nunca fixture destrutiva em banco da aplicação.
- [x] Implementar as cinco rotas da spec, DTO sem campos auth, Cache-Control no-store, origem JSON, erros genéricos, queries Prisma parametrizadas.
- [x] Transação de criação; updates condicionais por versão; inclusão de variante trava versão do produto antes de contar. Conflitos Prisma/versão viram 409.
- [x] GREEN: anônimo/pending/bloqueado/revogado/user-write, unicidade concorrente, rollback, versões, ativação efetiva, grants SQL e restauração de catálogo.

## T3 — Tela de catálogo local

**Arquivos:** `apps/web/src/catalog/CatalogScreen.tsx`, `api.ts`, `catalog.css`, `App.tsx`, `Access.tsx`, `inventory/types.ts`, `inventory/components/Shell.tsx`; `.env.example`, `compose.catalog.yaml`.

**Interfaces:** cliente tipado lista/muta /api/catalog; erro 401/403 limpa dados e volta ao acesso por callback de contexto. Menu só com flag VITE_CATALOG_ENABLED, habilitada pelo Compose local.

- [x] Smoke RED: menu/formulário ainda ausentes.
- [x] Implementar lista, busca/filtro, cadastro com variantes, edição de produto/variante, SKU read-only, confirmação de inativação e estados reais loading/vazio/erro/sucesso.
- [x] Preservar estilos, fluxo de login e demonstração atual; manter aviso claro de catálogo integrado vs saldos simulados. Sem browser storage de catálogo/token.
- [x] GREEN desktop/mobile: criar, recarregar, duplicar, editar, inativar; usuário comum sem ações; sessão expirada limpa UI; nenhum overflow.

## T4 — Ambiente de demonstração e evidências

**Arquivos:** scripts de ensaio/seed local restritos, `docs/operations/basic-catalog.md`, spec/plano MVP e orientações do repositório.

- [x] Subir stack local própria `fasemarketplace-catalog-local`, portas 4873/4874, banco/Redis/roles exclusivos; envs/chave/senhas privadas ignoradas. Nenhum reset em stacks anteriores.
- [x] Bootstrap de administrador novo com senha provisória privada/troca obrigatória, conta distinta de automação; exemplos sintéticos via API autenticada, sem seed no startup.
- [x] Verificar reload/reinício da API e backup/restore dos modelos; executar lint/typecheck/test/build Docker e regressão de acesso.
- [x] Revisão independente, corrigir achados com testes; documentar evidências, limites e comandos. Não incluir este trabalho na promoção anterior da SPEC-010.

Evidências e limites: [guia operacional](../../operations/basic-catalog.md). Entrega local concluída em 27/10/2026; nenhuma publicação do catálogo.
