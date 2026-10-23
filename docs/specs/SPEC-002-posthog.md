# SPEC-002 — Análise de uso e diagnóstico com PostHog

Data: 23/10/2026. Autorizado pelo usuário: instrumentar uso do sistema e diagnóstico técnico. O usuário ainda não possui conta/projeto PostHog. Não criar conta, recursos remotos nem enviar dados a projetos não confirmados.

## Desenho

Instrumentação explícita na SPA React, API NestJS e worker. SDKs oficiais `posthog-js` e `posthog-node`; contrato compartilhado de eventos/configuração e filtragem de propriedades. Modos `off`, `console` e `posthog`; padrão `off`. Modo console permite verificar os eventos sanitizados localmente, sem SDK ativo nem rede. Falhas ou configuração inválida de telemetria nunca impedem o funcionamento da aplicação.

Não instalar a plataforma PostHog no Compose. A futura ativação usará um projeto confirmado e token público de ingestão, com região US/EU explícita. Nenhum token de administração ou Personal API Key no navegador. O local deve usar projeto de desenvolvimento separado do futuro produtivo; worker não ganha saída de rede por esta tarefa.

## Eventos iniciais

| Evento | Origem | Contexto permitido |
|---|---|---|
| `screen viewed` | Web, fora de efeitos React duplicados | Tela conhecida `bootstrap` |
| `diagnostic refreshed` | Clique explícito na ação já existente | Tela conhecida |
| `api readiness checked` | Resultado da consulta pela web | Resultado e duração limitada |
| `$exception` | Error boundary React, erros globais do navegador, exceções inesperadas HTTP e falhas do worker | Código estável, serviço, classe e localização sanitizada do erro |

Propriedades comuns: ambiente, serviço, release e versão do contrato. Não coletar texto de formulários, URLs completas/query/hash/referrer, headers, corpos HTTP, tokens, dados de comprador, pedidos ou mensagens originais de exceções. A captura de erros mantém categoria/código e frames sanitizados, sem caminhos locais absolutos. Excluir eventos automáticos e propriedades inesperadas em `before_send`.

Sem replay, autocapture de cliques, flags, surveys ou Self-driving. Identificação autenticada fica para a spec de autenticação; nesta etapa há somente identificadores anônimos opacos do SDK e identificadores técnicos sem perfis de pessoas no backend. Não inferir pessoa real a partir de IP/email.

## Confiabilidade

- Captura em memória/fila do SDK, sem aguardar envio em requisições ou heartbeat.
- Filas e tentativas limitadas, tratamento de erro sem logar payload/credenciais; flush de encerramento limitado.
- Erros HTTP mantêm status/resposta; healthchecks não geram exceções por polling e falhas esperadas 4xx não são tratadas como bugs.
- Worker registra falha de dependência uma vez por transição, sem emitir a cada heartbeat.
- Backend continua livro oficial de estoque/vendas; PostHog observa o uso e falhas, sem modificar transações.

## Plano e aceite

- [x] Criar contrato de eventos, configuração e sanitização com testes de dados sensíveis e falhas de transporte.
- [x] Instrumentar React, consultas ao diagnóstico, interação e error boundary; impedir duplicação por StrictMode.
- [x] Integrar serviço Nest, filtro de exceções e falhas/transições do worker sem alterar semântica HTTP.
- [x] Configurar env/Compose/build sem segredos administrativos, padrão desligado e instruções de onboarding.
- [x] Validar SDKs com transporte interceptado/falso, browser, ausência de envio desligado e falhas sem bloquear aplicação.
- [x] Executar instalação limpa, lint, typecheck, testes, build, smoke e revisão; preservar volumes e alterações existentes.

## Evidências em 23/10/2026

- SDKs fixados: `posthog-js` 1.438.21 e `posthog-node` 5.57.1. Contrato compartilhado sem runtime de build, com definições TypeScript públicas; testes verificam o comportamento JavaScript e os aplicativos verificam os tipos consumidores.
- Build limpo Docker aprovado com `npm ci`, lint, typecheck, **25 testes** (8 contrato + 17 backend) e builds dos aplicativos. Transporte Node real do SDK interceptado no teste confirma exceção sanitizada; não houve envio à API PostHog real.
- Browser com SDK real e ingestão interceptada: um `screen viewed` e um resultado inicial de readiness apesar do StrictMode; interação de atualizar diagnóstico capturada sem recarregar a página; `$exception` de navegador e fallback/error boundary React verificados.
- Query, hash, referrer e mensagens de erro sintéticos usados para verificar ausência desses dados nos payloads e em localStorage/sessionStorage/cookies. Replay, flags, surveys e carregamento de assets externos do SDK não foram solicitados.
- Modos off e console: nenhum tráfego de ingestão, aplicação saudável e eventos locais no console quando solicitado. Transporte bloqueado: interface e ação de atualizar diagnóstico continuam operacionais.
- Teste de volume atravessa vinte janelas de minuto e confirma o teto de 500 tentativas por página, mesmo sem callback de falha de rede. Filas Node e buffer inicial do browser também são limitados.
- Revisão independente apontou persistência de atribuição e fila de retries offline do SDK; ambos corrigidos e revisados novamente, sem novos achados materiais. SDK no navegador usa memória, sem persistência; URLs de contexto reduzidas à origem, e propriedades enviadas passam pela lista permitida.
- Containers temporários usaram somente tokens sintéticos, portas loopback e transporte interceptado; removidos após os testes. Nenhuma conta/projeto/dashboard remoto, commit ou publicação foi criado. O `.env` existente foi preservado, com coleta efetivamente desligada pelos defaults.

O [guia PostHog](../operations/posthog.md) contém onboarding, catálogo, limites de identificação anônima, configuração de região/token e instruções de ativação. O worker mantém rede interna como padrão; a saída opcional só é acrescentada pelo override explícito. As evidências anteriores da SPEC-000/001 continuam como histórico de suas próprias entregas.

## Ativação externa pendente

Sem conta/projeto/token não é possível demonstrar eventos recebidos no PostHog real ou criar dashboards na conta do usuário. A implementação deve ser testável localmente e incluir um catálogo que permita montar depois os painéis de uso, diagnóstico e erros. Relatar essa limitação explicitamente; não apresentar teste simulado como ingestão homologada.
