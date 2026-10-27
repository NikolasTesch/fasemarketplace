# SPEC-011 — Catálogo básico: produtos, variantes e SKUs

**Data:** 26/10/2026. **Estado:** aprovada pelo usuário e implementada/homologada no Docker local em 27/10/2026, após integração/publicação da SPEC-010. Evidências no [guia operacional](../operations/basic-catalog.md). Complementada pelas [SPEC-017](SPEC-017-product-icons-and-stock-entry.md) e [SPEC-018](SPEC-018-catalog-pricing.md). Catálogo sem publicação.

## Objetivo

Permitir experimentar o cadastro que sustentará o estoque: criar, consultar, editar e inativar produtos e variantes persistidos. Uma empresa piloto, sem integração de marketplace, imagens, código de barras ou publicação externa nesta fatia. Ícones esportivos e campos de preço/custo foram adicionados pelas SPEC-017/018. Saldo não é campo livre de produto.

Fontes: RF-02 e linguagem de [PRD](../../prd.md), [arquitetura](../../architecture.md), [plano E03](../superpowers/plans/2026-10-24-mvp-integrations.md), [SPEC-010](SPEC-010-business-persistence.md).

## Abordagem escolhida

Usuário confirmou catálogo simples com nome/descrição de produto e variantes nomeadas com SKU manual, único e imutável após cadastro. Administrador cria/edita/inativa; usuário comum consulta. A alternativa de matriz cor/tamanho com geração automática de combinações foi apresentada e adiada. Não usar atributos fictícios como regras obrigatórias.

## Modelo e regras

- Produto: UUID estável, nome obrigatório (1–120 caracteres após trim), descrição (até 2000), ícone Material Symbols com lista fechada, preço de venda e custo em BRL (ver SPEC-018), ativo/inativo, versão para concorrência e metadados de criação/alteração.
- Variante: UUID estável, produto obrigatório, nome obrigatório (1–100), SKU obrigatório, ativo/inativo, versão e metadados de criação/alteração. Um produto simples também nasce com uma variante, sugerida como “Padrão”.
- SKU é identificador interno da variante, independente de anúncios. Normalização aprovada: trim + maiúsculas; 1–64 caracteres ASCII, letras/números e separadores ponto, hífen e sublinhado, começando por letra/número. Exemplo `CAM-PRETA-M`. A unicidade também vale para variantes inativas; código não é reutilizado. Rejeitar caracteres invisíveis e espaços internos.
- Nome de produto e nome de variante podem se repetir; identidade/uniquidade dependem dos UUIDs e do SKU, sem impor outra regra comercial.
- Produto é criado com pelo menos uma variante, em uma transação. Não existem produtos órfãos por falha parcial nem duplicação após reenvio dos mesmos SKUs.
- Variante não muda de produto e SKU não é editável; nome/descrição/ativação podem mudar. Não existem exclusão física ou endpoint de remoção.
- Variante está efetivamente ativa somente se ela e o produto estiverem ativos. Inativar/reativar produto não reescreve os flags das variantes; isso preserva as inativações individuais.
- Autor é o ID da sessão validada pelo backend, nunca campo enviado pelo navegador. Metadados mínimos não são um histórico completo de estoque.
- Edição exige versão atual; conflito retorna 409 e pede recarga. Evitar sobrescrita silenciosa de alterações de outro administrador.

## Persistência e permissões

Prisma cria `business.catalog_product` e `business.catalog_variant`, relação obrigatória/foreign key sem cascata destrutiva, unique de SKU e checks de campos/versão. Role runtime recebe SELECT/INSERT e UPDATE somente nas colunas editáveis; sem DELETE/TRUNCATE ou UPDATE de SKU/identidade/autor de criação. Migration não toca public/auth.

Catálogo habilitado somente quando `CATALOG_ENABLED=true`, `BUSINESS_ENABLED=true` e autenticação local ativa no mesmo banco e na origem local. Padrão desligado. Recusar habilitação sem auth, contexto Preview/Production ou conexões cruzadas antes de servir rotas. Não ampliar Functions/gateway remoto nesta fatia. Web recebe somente flag pública opt-in; nenhuma conexão de banco.

## Contrato da API local

Prefixo NestJS `/catalog`, consumido por `/api/catalog` via Vite. Cookies/sessões e verificação de origem reutilizam o acesso existente. Conta bloqueada, senha provisória ou sessão revogada não acessam catálogo. Toda leitura exige sessão válida; toda escrita exige administrador e origem JSON correta. Respostas `Cache-Control: no-store`; mensagens sem SQL, payloads ou credenciais.

- `GET /catalog/products?offset=0&search=...&status=all`: consulta paginada, busca por produto/variante/SKU, filtro ativo/inativo/todos. Offset inteiro não negativo, search até 80 caracteres; página fixa 20 produtos com variantes e contagens. Ordenação estável por criação/ID.
- `POST /catalog/products`: nome, descrição e variantes iniciais (nome/SKU); criação atômica, ativo por padrão.
- `POST /catalog/products/:id`: nome, descrição, ativo e versão atual; atualização otimista.
- `POST /catalog/products/:id/variants`: nome/SKU e versão do produto; incrementa versão do produto e inclui a variante sem duplicação.
- `POST /catalog/variants/:id`: nome, ativo e versão atual; SKU/produto/IDs/autores são campos desconhecidos e recusados.

Orçamento técnico do piloto: até 20 variantes por criação e 50 por produto; rejeitar excesso com 400 sem alterações parciais. Payload mantém o limite JSON de 8 KiB existente. Atualização do produto serializa inclusão concorrente de variantes, inclusive para respeitar o limite. 400 inválido, 401 sessão, 403 perfil/pendência/origem, 404 identidade inexistente, 409 SKU/versão conflitante, 503 infraestrutura. Não confiar na interface como autorização.

## Interface

Nova entrada **Catálogo** no shell existente, visível somente no modo local habilitado. Tela reaproveita estilos do protótipo, com busca/filtro, produto e suas variantes/SKUs/status, formulários de produto e inclusão/edição de variante, confirmação de inativação e feedback de sucesso após persistência.

Usuário comum vê consulta, sem ações administrativas. SKU aparece read-only na edição. Loading/vazio/erro/recarregar são estados reais de requisição; não usar controles simulados de estado no catálogo. Ao expirar sessão, limpar dados carregados e pedir novo login; não guardar catálogo/token em localStorage/sessionStorage.

O catálogo não inventa saldos ou atualiza as telas de estoque/pedidos ainda simuladas. Exibir “Catálogo integrado; movimentações e saldos ainda em demonstração” e “Estoque ainda não integrado” onde necessário. Dados reais do catálogo não podem parecer sincronizados nos canais.

Exemplos locais sintéticos, criados pelo fluxo normal autenticado após setup: produto simples “Garrafa esportiva” com variante “Padrão”/`GAR-SPORT-750`; “Camiseta treino” com “Preta / M” e “Preta / G”; “Meia esportiva” com duas variantes. Sem seed automática em startup, banco remoto ou contas reais.

## Operação e validação

Entrega só no Docker local isolado, com envs/volumes próprios e credenciais privadas. Não sobrescrever envs pessoais nem resetar credenciais existentes. Para demonstração, primeiro administrador local exclusivo em arquivo ignorado e senha provisória com troca obrigatória; conta de teste separada para automação.

Antes da migration, backup criptografado e restore em quarentena conforme SPEC-010. Gerar migration em alvo/shadow descartáveis, revisar SQL e aplicar explicitamente. Conferir checksum/reaplicação e grants/constraints. Manter mocks e escrita externa desabilitados; sem publicação adicional do catálogo por esta spec.

Critérios:

1. Produto simples e produto com variantes persistem e reaparecem após reload/reinício da API; UUIDs e SKU preservados.
2. SKU duplicado normalizado, inclusive inativo e concorrente, retorna 409. Falha em uma variante inicial reverte produto inteiro.
3. Campos desconhecidos, SKU editado, autor adulterado, payload excessivo e nomes vazios são recusados.
4. Usuário comum consulta e recebe 403 nas escritas diretas; pendência/bloqueio/revogação não são contornáveis pela rota.
5. Versão desatualizada retorna 409 sem sobrescrever alterações; produto/variante inativos seguem a regra de ativação efetiva.
6. Runtime não altera SKU/identidade nem apaga dados por SQL; nenhuma permissão nova sobre auth. Backup/restore inclui os dois modelos e constraints.
7. Navegador desktop/mobile cobre criação, duplicidade, edição, inativação, perfil de consulta, vazio/erro e recarga sem overflow. Nenhum saldo de estoque/marketplace é apresentado como integrado.
8. Lint, typecheck, suíte regular, integrações e build Docker passam; revisão independente e evidências documentadas. Sem dados/credenciais de Production nos testes.
