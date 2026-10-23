# PostHog — uso do sistema e diagnóstico técnico

## Estado e propósito

Integração implementada pela [SPEC-002](../specs/SPEC-002-posthog.md), com SDKs oficiais no React e NestJS. O usuário ainda não tem conta/projeto PostHog. O padrão local é `off`: nenhum SDK de navegador é inicializado e nenhum evento é enviado. Integração de código não significa ingestão externa homologada.

PostHog mede uso de telas/ações e agrupa falhas técnicas. Relatórios oficiais de vendas, reservas e estoque continuam no backend/PostgreSQL. Não instalar PostHog como serviço local nem usar Self-driving, integrações de repositório, replay, captura automática de cliques, surveys ou flags nesta etapa.

## Modos

| Modo | Resultado |
|---|---|
| `off` | Sem envio nem logs de eventos; padrão |
| `console` | Eventos sanitizados no console do navegador e logs Nest; nenhuma chamada de ingestão |
| `posthog` | SDK oficial envia ao projeto/região configurados; exige token público de ingestão válido |

`TELEMETRY_MODE` controla web/API. `WORKER_TELEMETRY_MODE` é independente e também inicia desligado. No Docker local, os eventos sempre têm `environment=local`. Identificar uma sessão de desenvolvimento como Produção é recusado pelo código. `APP_RELEASE` permite associar eventos a uma versão; usar identificador técnico curto, sem dados pessoais.

Para experimentar sem conta: editar o `.env` local para `TELEMETRY_MODE=console` e, opcionalmente, `WORKER_TELEMETRY_MODE=console`. Executar `docker compose up -d --no-build --no-deps --wait api worker web` após a imagem já ter sido construída. Abrir o console do navegador, carregar a página e usar “Atualizar diagnóstico”. Consultar `docker compose logs api worker` para os eventos backend. Voltar para `off` e recriar esses serviços para desligar.

## Primeiro projeto e ativação

1. Criar uma conta no [PostHog](https://posthog.com/) e escolher conscientemente a região US ou EU.
2. Criar um projeto **FaseMarketplace — Desenvolvimento**. O futuro projeto produtivo deve ser separado; nunca reutilizar a chave produtiva no Docker local.
3. Em **Project settings**, obter o **project token de ingestão** (`phc_...`). Este token é público e pode aparecer no frontend. Não usar Personal API Key (`phx_...`) nem Project Secret (`phs_...`). Não colar tokens em chats, issues ou commits.
4. No `.env` ignorado, preencher:

```dotenv
TELEMETRY_MODE=posthog
POSTHOG_PROJECT_TOKEN=phc_substituir_pelo_token_do_projeto_de_desenvolvimento
POSTHOG_HOST=https://us.i.posthog.com
APP_RELEASE=development
WORKER_TELEMETRY_MODE=off
```

Para EU, usar `https://eu.i.posthog.com`. São os únicos hosts aceitos nesta implementação. A escolha da região deve coincidir com o projeto; não há autodetecção da conta. O token é suficiente para ingestão, não para administrar o projeto.

5. Recriar somente as aplicações: `docker compose up -d --build --no-deps --wait api worker web`. A configuração Compose mapeia valores públicos para `VITE_*` na web e passa os valores de servidor à API; a web não recebe credenciais do banco.
6. Abrir a interface e conferir os eventos reais na área de eventos do projeto PostHog. Somente após observar nome, ambiente e propriedades no destino correto considerar a ingestão homologada.

O worker permanece na rede interna sem saída. Para habilitar envio externo dele, configurar `WORKER_TELEMETRY_MODE=posthog` e usar a configuração opt-in:

```powershell
docker compose -f compose.yaml -f compose.posthog.yaml up -d --build --no-deps --wait api worker web
```

O override acrescenta uma rede de saída ao worker e não publica portas. Só usá-lo depois de confirmar o projeto de desenvolvimento. Não executar resets, remover volumes ou alterar banco/Redis para ativar telemetria. Sem o override, preferir modo console/off no worker.

Em um futuro build estático, variáveis `VITE_*` precisam existir **durante o build**; editar variáveis do servidor depois de gerar `dist/` não altera o bundle. O Dockerfile atual é de desenvolvimento/verificação; o pipeline de produção ainda não foi criado.

## Catálogo e primeiros painéis

| Evento | Propriedades específicas | Pergunta inicial |
|---|---|---|
| `screen viewed` | `screen=bootstrap` | Quantas sessões acessam a tela? |
| `diagnostic refreshed` | `screen=bootstrap` | Com que frequência o usuário precisa rever o diagnóstico? |
| `api readiness checked` | `status`, `duration_ms` limitada | Que proporção de consultas encontra dependências indisponíveis? |
| `$exception` | `code`, `error_kind`, `error_site` quando disponível | Quais falhas se repetem e em qual versão/serviço? |

Propriedades comuns: `environment`, `service`, `release`, `schema_version`. Os nomes/propriedades permitidos estão em `packages/telemetry`; adicionar novos eventos exige atualizar contrato, catálogo e testes. Não capturar nomes de recursos ou textos arbitrários como nomes de evento.

Depois da primeira ingestão, criar painéis no projeto correto: **Uso do produto** (acessos e ações), **Diagnóstico** (consultas/indisponibilidade/duração) e **Erros** (Error Tracking por release e serviço). Não há dashboards remotos criados nesta entrega, pois não existe projeto do usuário. A tela atual é apenas o bootstrap; eventos de cadastro, busca, filtros e fluxos de estoque serão adicionados nas respectivas specs, sem inventar uso de funcionalidades inexistentes.

## Privacidade e limites

- Navegador usa ID anônimo opaco somente em memória, sem persistência PostHog em localStorage/cookies; ainda não há autenticação ou identificação de usuário. Assim, não medir retorno da mesma pessoa entre recargas nesta etapa. Backend usa identidades técnicas `system-api`/`system-worker`, sem processar perfis pessoais. Identidade entre navegador/backend e reset no logout serão tratados com a autenticação.
- Sem URL completa, query, hash, referrer, IP como dimensão, mensagens originais de exceção, headers, corpos, tokens de marketplace ou informações de comprador. GeoIP desabilitado. O endereço IP continua existindo no transporte de rede ao provedor; desabilitar GeoIP não é uma promessa de anonimato absoluto.
- `before_send` reconstrói propriedades pela lista permitida e remove traits e eventos automáticos. Erros preservam código estável, classe e alguns frames de aplicação com basename/linha/coluna; nomes de função, mensagens e caminhos completos são removidos.
- Essa minimização reduz detalhe diagnóstico. Source maps não são enviados e stacks minificadas não estão homologadas; mensagens completas, gravações e enriquecimento exigem desenho próprio antes de ampliar a coleta.
- Consultas periódicas aos healthchecks não geram eventos de erro no servidor. Worker reporta a primeira falha após estar saudável, não cada heartbeat; na inicialização, espera três verificações malsucedidas para distinguir conexão inicial em andamento de falha sustentada. Os aborts intencionais do StrictMode não contam como falha e o acesso inicial é emitido fora de efeitos React duplicados.
- Até 120 tentativas de evento por minuto/processo ou página; erro repetido por código/localização é deduplicado por um minuto. SDK Node tem fila de até 100, timeout de requisição de 2 s, sem retries e shutdown limitado a 1 s. Browser tem buffer inicial de até 20 ações, limite total de 500 tentativas por carregamento (inclusive durante offline prolongado) e interrompe novas capturas após erro HTTP do transporte até recarregar a página. Esse teto independe do callback do SDK, que não sinaliza todos os erros de rede. Nenhum desses eventos é um livro durável de negócio.
- Erros esperados HTTP 4xx são preservados e não classificados como bug. Exceções inesperadas 5xx, error boundary React, erros/rejections do navegador e falhas detectadas pelo worker são instrumentados. Não instalar handlers Node que ocultem crashes fatais; logs do processo continuam necessários.

## Evidências e referências

Testes automatizados cobrem filtragem, exceções, transporte interrompido e preservação HTTP. Testes de browser/transporte simulado não comprovam ingestão real. Evidências e limitações estão na SPEC-002.

- [SDK JavaScript e configuração](https://posthog.com/docs/libraries/js/config).
- [SDK Node](https://posthog.com/docs/libraries/node).
- [React e Error Tracking](https://posthog.com/docs/error-tracking/installation/react).
- [Captura de eventos](https://posthog.com/docs/product-analytics/capture-events).
