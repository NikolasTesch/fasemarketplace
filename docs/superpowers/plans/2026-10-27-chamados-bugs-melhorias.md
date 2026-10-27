# Chamados de bugs e melhorias — plano de implementação

> **Para agentes:** executar as tarefas na ordem e manter os passos verificáveis. Não fazer commit, push, publicação, merge ou deploy nesta entrega.

**Objetivo:** adicionar abertura e consulta compartilhada de chamados de erro/melhoria com persistência local, imagem opcional, sessão autenticada e nenhum recurso de edição nesta etapa.

**Arquitetura:** React/Vite adiciona a tela e o modal ao shell atual. NestJS oferece rotas de leitura/criação protegidas pela autenticação local; PostgreSQL armazena dados e o anexo binário. Migration e ativação permanecem explícitas e restritas ao Docker local.

**Stack:** React + TypeScript + Vite; NestJS + Express; PostgreSQL via `pg`; Better Auth existente; upload multipart limitado pelo Multer já incluído na árvore de dependências NestJS.

**Spec:** `docs/superpowers/specs/2026-10-27-chamados-bugs-melhorias-design.md`

**Atualização aprovada pelo usuário em 27/10/2026:** preparar uma porta `TicketImageStorage` com PostgreSQL como adapter atual para permitir Cloudflare R2 futuramente. Não criar bucket/credenciais nem alterar ambientes remotos. Migration 002 cria metadados e tabela de anexos local; migration 003 revoga DELETE direto da role runtime, mantendo apenas leitura/criação.

## Restrições globais

- Não alterar dados, schema, credenciais ou serviços Preview/Production/Neon; não publicar nem ativar remotamente.
- O módulo de chamados só fica disponível com autenticação explicitamente ativa no Docker local; usuários com troca de senha pendente não acessam por chamadas HTTP, pois o `AccessGuard` atual admite a leitura de sessão pendente. Criar `TicketAccessGuard` dedicado que exige `principal(request, false)`.
- Todos os usuários autenticados podem ler e criar. Não adicionar endpoint ou controle visual para editar, comentar, atribuir ou fechar chamados.
- Persistir chamados e uma imagem opcional no PostgreSQL. Limite por imagem: 5 MiB; formatos permitidos: PNG, JPEG e WebP, validados pelo conteúdo além do MIME declarado.
- Campos: tipo `bug|improvement`; tela conforme as opções vigentes da navegação; título de até 160 caracteres; descrição de até 4.000 caracteres. Campos de texto obrigatórios e imagem opcional única.
- Status inicial único: `open` (exibido como “Aberto”). Lista paginada, 20 itens por página, ordem `created_at DESC, id DESC`.
- Migration é explícita, checksum-verificada e executada apenas com a configuração local confirmada. Preservar migration e bootstrap existentes de autenticação.
- Não afrouxar o parser JSON global de 8 KiB nem os controles CSRF/origin existentes; uploads multipart validam origem e limites próprios.
- Preservar todas as alterações já presentes no worktree; não incluir trabalho alheio ao escopo.

## Arquivos e responsabilidades

- `apps/backend/migrations/002_tickets.sql` e `003_revoke_ticket_image_delete.sql` — tabelas/constraints/índices e grants mínimos da role runtime local, com provedor/chave de storage e bytes locais numa tabela de anexos.
- `scripts/tickets-local.mjs` e `package.json` — aplicação explícita e checksum-verificada da migration no banco local, sem tocar a migration 001.
- `apps/backend/src/tickets/{module,controller,service,validation,guard,image-storage}.ts` — contrato HTTP, autorização, validação, persistência, paginação e interface/adaptador local de anexos.
- `apps/backend/src/access/module.ts` exporta `LocalAccessService`; `apps/backend/src/tickets/module.ts` importa o módulo de acesso; `apps/backend/src/app.module.ts` carrega ambos somente quando a autenticação local está habilitada.
- `apps/backend/test/tickets-validation.test.cjs`, `tickets-storage.test.mjs`, `tickets-service.test.mjs`, `tickets-disabled.test.mjs` e `tickets.integration.mjs` — limites/validação, porta local, rollback de criação, auth desligada e fluxo HTTP contra PostgreSQL/Redis locais isolados.
- `apps/web/src/inventory/types.ts`, `components/Shell.tsx`, `App.tsx` — navegação, estado de tela e integração da nova página, sem expô-la com auth desabilitada.
- `apps/web/src/tickets/{api,TicketScreen,NewTicketModal}.tsx` e `apps/web/src/tickets/tickets.css` — cliente HTTP, lista paginada, detalhes de leitura e modal de abertura.
- `docs/operations/local-access.md` e `README.md` — comandos seguros para migration/validação e limites do recurso local.

## Review Focus

- Sessão ausente, bloqueada ou senha pendente tenta chamar GET/POST diretamente: deve receber recusa pelo backend. Cobrir na integração.
- Arquivo declara MIME permitido mas contém bytes de outro formato, arquivo vazio ou acima de 5 MiB: deve ser recusado sem gravar ticket. Cobrir na validação/integração.
- Corpo multipart com campos extras, enum inválido, strings vazias/longas ou ausência de campo obrigatório: retornar erro de validação sem persistir. Cobrir na validação/integração.
- Paginação recebe offset negativo, fracionário, inválido ou enorme: normalizar/recusar de forma estável sem expor SQL. Cobrir na validação/integração.
- Migration executada com configuração não local, checksum divergente ou repetição: recusar destino não local, falhar em checksum incompatível e permitir repetição idempotente. Cobrir na ferramenta de migration local.

---

### Tarefa 1 — schema local e contrato de persistência

**Arquivos:** `apps/backend/migrations/002_tickets.sql`, `003_revoke_ticket_image_delete.sql`; `scripts/tickets-local.mjs`; `package.json`; validação da migration em PostgreSQL descartável conforme o procedimento de acesso local.

**Interfaces:** cria `support_ticket` com metadados e `image_storage_provider`, `image_storage_key`, `image_mime`; `support_ticket_image` mantém os bytes PostgreSQL com chave opaca. A FK para `auth_user` é restrita; checks e índice protegem o contrato. Runtime recebe `SELECT/INSERT` em ambas as tabelas e nenhum DELETE direto.

- [x] Adicionar migration SQL versionada com constraints para `bug|improvement`, `open`, campos obrigatórios e tipos de tela definidos pelo contrato atual.
- [x] Criar migration runner local explícito que confirme auth local habilitada e destino PostgreSQL em Docker local, serialize com advisory lock `734007`, use transação, registre checksums das migrations 002/003 em controle próprio para chamados e aplique grants mínimos.
- [x] Em PostgreSQL descartável, testar reexecução com checksum igual; checksum divergente e configuração/destino não local cobertos pelos testes da ferramenta; restore isolado confirmou migration 001 preservada.
- [x] Adicionar script `tickets:migrate` e documentar comando: `docker compose run --rm --no-deps -T api npm run tickets:migrate` após confirmar `.env` local.

### Tarefa 2 — API autenticada de leitura e abertura

**Arquivos:** `apps/backend/src/tickets/{module,controller,service,validation,guard,image-storage}.ts`; `apps/backend/src/access/module.ts`; `apps/backend/src/app.module.ts`; `apps/backend/src/main.ts` apenas se necessário para registrar limite multipart específico; `apps/backend/test/tickets-validation.test.cjs`; `apps/backend/test/tickets-storage.test.mjs`; `apps/backend/test/tickets-disabled.test.mjs`; `apps/backend/test/tickets.integration.mjs`.

**Interfaces:** `TicketImageStorage` define `provider`, `write(key, bytes, mime, transaction)`, `read(key)` e `discard(key)`; `PostgresTicketImageStorage` usa a mesma transação do chamado, então rollback remove ambos sem grant DELETE. Um adapter externo poderá usar `discard` se a gravação relacional falhar. `support_ticket` registra provedor/chave/MIME; bytes ficam na tabela local de anexos, sem permissão de DELETE direto para o runtime. `GET /tickets?offset=<inteiro>` retorna `{ tickets, total, offset, limit: 20 }`; `POST /tickets` aceita multipart; `GET /tickets/:id/image` usa o adapter indicado, MIME validado, `nosniff` e `no-store`. Todas as rotas exigem `TicketAccessGuard`; criação exige Origin exata e autor vem da sessão.

- [x] Escrever testes de validação para enums, texto vazio/limites, campos desconhecidos e assinatura real PNG/JPEG/WebP versus MIME declarado; confirmar RED antes da implementação.
- [x] Implementar `TicketValidation` com limites e validação de conteúdo (PNG/JPEG/WebP), rejeição de arquivo ausente ou múltiplo indevido, tamanho acima de 5 MiB e campos multipart fora do contrato.
- [x] Implementar `TicketAccessGuard` e controller NestJS, validação exata de origem para multipart, limite Multer (um arquivo, 4 campos, 16 KiB por campo, 5 MiB por arquivo) e nenhum endpoint de mutação adicional.
- [x] Implementar serviço SQL parametrizado: autor autenticado; gravação de anexo e chamado na mesma transação local; descarte de objeto em rollback para adapters externos; consulta paginada por data/id; busca do anexo por chave sem bytes na listagem.
- [x] Executar integração com Postgres/Redis locais isolados: usuário autenticado cria; outro usuário lista; paginação/ordem; leitura de imagem; imagem inválida/excessiva recusada sem persistência; sem sessão e senha pendente recusados.
- [x] Confirmar que as rotas não existem quando auth local está desabilitada e que o schema/runtime remoto não é alvo da migration (teste HTTP de rotas desligadas; allowlist/testes de recusa do runner para destinos remotos).

### Tarefa 3 — tela e fluxo de abertura

**Arquivos:** `apps/web/src/inventory/types.ts`; `apps/web/src/inventory/components/Shell.tsx`; `apps/web/src/App.tsx`; criar `apps/web/src/tickets/{api,TicketScreen,NewTicketModal}.tsx` e `apps/web/src/tickets/tickets.css`.

**Interfaces:** `tickets` é um `ViewScreen`; `TicketScreen` consome cliente HTTP autenticado e mantém offset/estado de carregamento/erro/vazio; modal recebe `onClose` e `onCreated`; upload usa `FormData`, sem serializar imagem em base64 e sem imprimir payload no telemetry.

- [x] Adicionar navegação lateral **Bugs e melhorias**, visível apenas com `VITE_AUTH_ENABLED=true`; ligar seleção da tela à `TicketScreen`.
- [x] Implementar lista paginada de 20, ordenada pelo backend, com tipo, título, tela, autor, data, estado “Aberto”, indicação de anexo e estado vazio/erro/carregamento. Permitir ler descrição/anexo, sem controles de edição.
- [x] Implementar modal acessível **Novo chamado**, com campos exigidos, opções de tela da navegação, prévia/nome da imagem, validação de UX, envio multipart, estado de submissão e preservação do formulário em erro.
- [x] Após sucesso, fechar modal, recarregar a primeira página e confirmar com feedback acessível; após 401/403 mostrar estado apropriado sem perder o relato preenchido.
- [ ] Validar visualmente desktop e viewport estreita, navegação por teclado, foco/fechamento do modal e leitura de anexo.

### Tarefa 4 — integração, documentação e revisão

**Arquivos:** `docs/operations/local-access.md`; `README.md`; arquivos desta feature.

- [x] Documentar migrations e procedimento local para executar somente após auth/bootstrap local; documentar formatos/tamanho e que a imagem fica no PostgreSQL e compõe seus backups.
- [x] Rodar lint, typecheck, suíte automatizada, integração HTTP em DB restaurado isolado e build após a correção transacional; registrar resultados.
- [x] Revisar diff por exposição de anexos, bypass de sessão, permissões/grants além de leitura/criação, consulta sem paginação, logs/telemetria com descrição ou imagem e alterações locais não relacionadas.
- [x] Inspecionar `git status`/diff; manter a migration somente no contexto local e não criar commit, push, PR, merge, publicação ou deploy.

## Cobertura da spec

A navegação, modal, campos, anexo opcional, persistência compartilhada, usuário autor, lista completa paginada, status Aberto, leitura após reinício, autenticação, ausência de edição/comentários/fechamento e restrição ao ambiente local estão cobertos nas tarefas 1–4. Não há alteração de perfil de acesso nem implementação/provisionamento de storage externo.

Evidência de aplicação autorizada em 27/10/2026: dump custom atualizado, restore isolado em PostgreSQL Docker local, migrations 002/003 aplicadas e reaplicadas no restore e no PostgreSQL persistente `fasemarketplace`. Fonte e bancos concordam nos checksums; restore preserva `001_auth`. Integração HTTP passou com o DB restaurado e Redis local. As imagens continuam armazenadas no PostgreSQL via `TicketImageStorage`; Cloudflare R2 não foi provisionado nem recebe tráfego.

Revisão independente: P2 de DELETE excessivo foi resolvido pela migration 003, que revoga o privilégio; a role runtime mantém SELECT/INSERT. P2 de anexo órfão foi resolvido pela gravação transacional PostgreSQL e hook `discard` para adapters externos após rollback, com teste de ordem. Não restaram P1/P2 na revisão final. Uma revisão anterior observou que o conteúdo não é decodificado além da assinatura MIME; o contrato aprovado exige checagem de assinatura, e decodificação/re-encoding fica como endurecimento futuro.
