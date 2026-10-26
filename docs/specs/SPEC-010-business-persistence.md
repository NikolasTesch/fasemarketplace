# SPEC-010 — Base de persistência de negócio com Prisma

**Data:** 26/10/2026. **Estado:** desenho aprovado pelo usuário; implementada e validada no Docker sintético local. Operação e evidências em [persistência local](../operations/business-persistence.md). Não ativada remotamente.

**Decisão confirmada:** usuário escolheu Prisma para a persistência de negócio. Integra a E02 do [plano do MVP](../superpowers/plans/2026-10-24-mvp-integrations.md).

## Objetivo e limites

Preparar persistência tipada, migrações verificáveis e recuperação para as próximas specs de catálogo e estoque. Primeira implementação e homologação somente no Docker local, com dados sintéticos; nenhuma alteração em Neon, Preview, Production, GitHub ou Vercel nesta entrega.

Não definir campos de produto, política de SKU, permissões de negócio, reservas ou filas nesta spec. Não substituir Better Auth, mover suas tabelas nem recriar usuários/sessões. Não criar tabelas fictícias permanentes apenas para demonstrar o ORM.

## Alternativas e decisão

- SQL com `pg`: preserva o mecanismo atual, mas exige escrever consultas e tipos; alternativa apresentada anteriormente.
- Prisma para negócio: escolha explícita do usuário; client tipado e histórico próprio para as próximas entidades.
- Migrar também autenticação para Prisma: amplia risco e escopo sem necessidade nesta etapa; descartado neste desenho.

Proposta de engenharia: schema PostgreSQL `business` exclusivo para negócio; autenticação e `auth_migration` permanecem em `public`, controladas pelos scripts existentes. Cada mecanismo tem seu próprio histórico. Prisma não inclui nem gerencia `public`. Demonstrar essa separação em testes de permissões e preservação, sem confiar apenas na configuração do gerador.

## Compatibilidade e organização

Proposta inicial: Prisma ORM 7 com patch exato fixado após checagem de compatibilidade de CLI, client e adaptador PostgreSQL no Node 24/TypeScript 6 e nas imagens Alpine atuais. A documentação consultada já distingue Prisma 8, cujo fluxo é diferente; não misturar comandos ou arquivos entre majors. Se a verificação exigir mudar a major proposta, registrar a justificativa antes de implementar o fluxo alternativo.

Arquivos candidatos: `apps/backend/prisma/`, configuração Prisma versionada, módulo de persistência em `apps/backend/src/persistence/`, scripts de manutenção e testes, Dockerfile, Compose opt-in, exemplos de env e guia operacional. Client gerado em caminho explícito, integrado ao build ESM/NodeNext e ignorado pelo Git; imagem final deve conter os artefatos necessários sem carregar CLI de manutenção ou segredos.

API usa client de negócio com ciclo de vida e encerramento explícitos. Worker só recebe conexão de negócio quando houver caso de uso aprovado; esta entrega não concede DML de negócio ao heartbeat. Configuração opt-in desligada por padrão preserva os modos existentes.

Não inventar entidade técnica para contornar limitações de geração sem modelos. Verificar isso no primeiro ensaio descartável: se o client exigir modelos, adiar sua instanciação/geração para E03, mantendo validação de configuração, migrações e isolamento testáveis nesta entrega. Registrar explicitamente a limitação.

## Credenciais e comandos

- `BUSINESS_DATABASE_URL`: runtime, sem propriedade de objetos, DDL, TRUNCATE, criação de roles ou associação à role de manutenção; DML limitado às tabelas concedidas pela fatia correspondente.
- `BUSINESS_MIGRATION_DATABASE_URL`: manutenção explícita; role proprietária somente de `business`, sem direitos nas tabelas auth. Não vai para API, worker, web, Vercel ou `VITE_*`.
- `BUSINESS_SHADOW_DATABASE_URL`: somente para geração em banco Docker descartável exclusivo; nunca reutiliza o banco alvo ou os volumes da aplicação.
- Provisionamento inicial de schema/roles por comando administrativo local separado; essa credencial não integra o runtime. Scripts devem ser reaplicáveis sem rotacionar senhas silenciosamente.

Os nomes acima são novos e não substituem `DATABASE_URL`/`AUTH_DATABASE_URL`. Exemplos usam placeholders; envs privados existentes não são sobrescritos.

Wrappers validam configuração antes de conectar ou iniciar Prisma: contexto local explícito, host `postgres`, porta 5432, bancos locais permitidos, schema `business`, runtime e manutenção distintos e shadow diferente do alvo. Recusar Neon, endereços arbitrários, contexto Preview/Production e parâmetros extras não previstos. URLs e senhas não aparecem em argv, logs ou erros; subprocessos recebem apenas ambiente mínimo.

Comandos planejados: verificar configuração/status, gerar client, gerar migration em banco descartável e aplicar migrations revisadas explicitamente. Nenhuma migration no startup da API/worker ou no build. Não expor reset, push, force-reset ou resolve automático como fluxo operacional. Geração nunca ocorre no volume que contém dados da aplicação.

Aplicação exige preflight do destino efetivo e histórico: arquivos aplicados presentes e checksum idêntico; divergência ou migration incompleta bloqueia aplicação. Não apresentar `migrate deploy` isolado como detector completo de drift. Detectar divergência estrutural em ensaio isolado e documentar os limites do preflight. Lock de manutenção não deve depender de conexão pooled; locks auth continuam preservados.

## Migrações e recuperação

Primeira migration de infraestrutura limita-se a `business` e ao histórico necessário, sem novas entidades de domínio. Gerar/testar a sequência em banco descartável com fixtures auth antes de aplicá-la explicitamente na stack local. Testar reaplicação sem duplicação, interrupção/falha e concorrência de execução. Conceder privilégios de negócio por objetos aprovados, sem grants globais de acesso à autenticação.

O backup atual da SPEC-009 cobre apenas `public`; portanto **não protege `business`**. Esta entrega precisa ampliar a recuperação antes de liberar persistência de negócio:

- Escopo permitido e explícito `public` + `business`, sem aceitar schema arbitrário do cliente.
- Mesmo snapshot consistente para dump e fingerprints dos dois schemas; identidade de tabela inclui schema e nome, ordenação estável e limites existentes de memória/quantidade.
- Formato interno versionado com leitura dos arquivos antigos `public` apenas, sem alterar o envelope criptográfico e sem reinterpretar silenciosamente nomes antigos.
- Restaurar exclusivamente em novo banco Docker de quarentena; manter exigência de major igual 17/18, sem aceitar destino existente ou remoto.
- Comparar conteúdo de ambos os schemas, incluindo histórico Prisma; preservar estado de sequences/identities por teste de nova inserção após restore. Verificar também estrutura/constraints relevantes nos ensaios.
- Revogar somente `public.auth_session` e `public.auth_verification` na cópia; tabelas homônimas em `business` não são alvo de revogação.
- Preservar AES-256-GCM, chave separada, ausência de dump plaintext em disco, permissões restritas e arquivos antigos válidos. Testar corrupção, chave errada e schema fora do escopo antes de qualquer escrita.

Política aprovada permanece: backup manual anterior à migration, retenção mínima 30 dias/7 cópias válidas conforme acumuladas, nenhuma exclusão automática, RTO meta 1h e RPO anterior à migration. Guarda somente local foi decisão explícita do usuário; perda do computador pode perder arquivo e chave. Não afirmar que guarda externa está concluída.

Rollback operacional: parar escritas de negócio, registrar falha, preservar banco/volume, avaliar correção aditiva. Se necessário, restaurar cópia em quarentena e comparar antes de qualquer promoção futura autorizada. Não executar down migration destrutiva, reset ou troca automática de banco. Login deve continuar funcional quando a fatia de negócio estiver desativada.

## Critérios de aceitação

1. Lint, typecheck, testes e build passam na imagem Docker com dependências fixadas; geração não conecta a banco remoto.
2. Destinos incorretos e credenciais cruzadas são recusados antes de abrir conexão; nenhum segredo chega à web ou a logs.
3. Migração local pode ser reaplicada; arquivo alterado/ausente, histórico divergente e falha interrompem o comando com erro claro e sanitizado.
4. Runtime não pode executar DDL/TRUNCATE nem acessar tabelas auth; manutenção de negócio não pode alterar auth. Login, mudança obrigatória de senha e logout existentes continuam passando.
5. Testes de transação, rollback, constraint e concorrência usam tabelas temporárias de fixture em bancos descartáveis, sem antecipar modelos de catálogo. Documentar quais testes usam Prisma e quais usam SQL de manutenção.
6. Backup/restore sintético PG17 e PG18 prova preservação de auth + negócio, sequences, histórico Prisma e revogação somente das sessões/verificações auth. Arquivos antigos continuam restauráveis.
7. Nenhum volume existente removido/resetado, nenhuma migration remota, nenhuma alteração de credenciais pessoais ou publicação externa.
8. Guia registra comandos reais, limites e evidências por critério. Client sem modelo, caso adiado, aparece como pendência explícita para E03, não como integração concluída.

## Sequência proposta

1. Ensaiar compatibilidade fixando a versão e validar configuração em testes descartáveis.
2. Preparar schema, roles e manutenção locais; provar limites de privilégios e histórico.
3. Ampliar backup/restore e validar compatibilidade com arquivos antigos em 17/18.
4. Integrar build/lifecycle quando possível sem entidades artificiais; validar regressão de acesso e documentar.

Cada passo deve ter testes direcionados antes de ampliar validações. Catálogo é E03, com spec e regras próprias após esta base.

## Referências

- [Plano do MVP](../superpowers/plans/2026-10-24-mvp-integrations.md).
- [SPEC-009 — backup](SPEC-009-access-backup.md).
- [Ativação do acesso Preview](../operations/preview-access-activation-2026-10-25.md).
- [Prisma ORM 7 — multi-schema](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/multi-schema).
- [Prisma ORM 7 — development e production](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/development-and-production).

Documentação oficial consultada em 26/10/2026. Suporte e comandos precisam corresponder à versão efetivamente fixada; documentação sem `/v7` já pode descrever a major 8.
