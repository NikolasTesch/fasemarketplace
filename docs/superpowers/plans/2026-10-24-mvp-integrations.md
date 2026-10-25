# Plano de implementação incremental do MVP

> **Execução:** `superpowers:executing-plans`, por entregas pequenas. Usuário autorizou criar este plano e iniciar a execução em 24/10/2026. Sem commit/push/deploy automático; aprovação para implementar não promove código ou dados entre ambientes.

**Objetivo:** substituir as simulações do protótipo por funcionalidades reais verificáveis, seguindo acesso → persistência/recuperação → catálogo → estoque → pedidos → marketplaces → relatórios/observabilidade.

**Arquitetura:** React/Vite consome APIs NestJS; API aplica permissões e invariantes, PostgreSQL guarda fatos e histórico, worker executa trabalho assíncrono. Redis é mecanismo de execução/limitação recuperável, sem substituir os fatos duráveis. Adaptadores de marketplace começam simulados e leitura precede qualquer escrita externa.

**Stack:** TypeScript, React/Vite, NestJS, PostgreSQL/Neon, Redis, Better Auth. ORM e BullMQ só serão introduzidos após desenho da fatia que precisa deles.

**Fontes:** [PRD](../../../prd.md), [arquitetura](../../../architecture.md), [SPEC-007](../../specs/SPEC-007-local-access.md), [rascunho remoto SPEC-008](../../specs/SPEC-008-preview-access.md), [fluxo de entrega](../../operations/devops-pipeline-workflow.md), [homologação visual](../../operations/inventory-preview-homologation-2026-10-24.md).

## Regras de execução

- Cada entrega termina com comportamento observável, testes e documentação; as seguintes não começam como grandes blocos vagos de código.
- Specs existentes prevalecem sobre nomes do backlog conceitual do PRD. Verificar número livre antes de criar nova spec.
- Primeiro concluir/desenhar a spec da fatia, resolver escolhas materiais e então implementar. Não inventar permissões de negócio, política de SKU, reserva, cancelamento ou corte de pedidos.
- Docker local com dados sintéticos → revisão → Preview autorizado → Production autorizada em entrega própria. Nunca usar conexão produtiva em desenvolvimento.
- Preservar trabalho no checkout original. Esta execução usa o worktree existente em `codex/mvp-access-integration`, partindo de `origin/development` `7236a4612961538445508b1b73eafbefe7491213`.
- Preservar o modo de demonstração identificado; não apresentar uma tela simulada como operação real. Apenas o fluxo integrado perde a simulação após validação.
- Não contratar serviço, enviar e-mail, publicar estoque/anúncio ou configurar PostHog externo sem decisão e autorização aplicáveis.

## Foco de revisão

| Falha | Verificação necessária |
| --- | --- |
| Interface permite contornar perfil, bloqueio ou senha provisória | Chamadas diretas à API e navegação com sessões de perfis distintos |
| Troca de ambiente mistura sessões, dados ou segredos | Recusa de configuração cruzada e confirmação do destino efetivo |
| Retry/repetição de formulário duplica fatos | Idempotência/concorrência da fatia e invariantes no banco |
| Restore devolve sessões e reexecuta escritas antigas | Restore isolado com revogação, escritas pausadas e reconciliação |
| Relatório aparenta precisão sem dado oficial | Proveniência/cobertura e estados indisponíveis explícitos |

## E01 — Acesso e permissões

### E01.1 — Unir autenticação local e frontend homologado (concluída tecnicamente no Docker local)

**Spec:** SPEC-007 aprovada; complemento desta integração abaixo. **Arquivos:** `apps/web/src/App.tsx`, `Access.tsx`, `access.css`, `inventory/components/Shell.tsx`; módulo `apps/backend/src/access`, migration `001_auth.sql`, scripts `auth-local.mjs` e exemplos/Compose já implementados no checkout original.

- [x] Conferir e portar seletivamente o trabalho de autenticação sem commit para o worktree baseado no frontend publicado, sem copiar segredos ou sobrescrever as telas.
- [x] Criar stack Docker local isolada, portas 4773/4774, volumes e credenciais próprios; inicializar schema por comando explícito.
- [x] Observar RED no smoke de navegador: com auth ativa e sem sessão, a tela deve pedir login e não renderizar o estoque; o protótipo atual não faz essa verificação.
- [x] Envolver `InventoryApp` no componente Access somente quando `VITE_AUTH_ENABLED=true`. No modo demonstração, preservar acesso ao protótipo sem inventar autenticação remota.
- [x] Passar identidade/perfil ao shell no modo autenticado; remover a identidade fictícia "Operador Estoque" nesse contexto. Manter administração/saída e restrição de senha provisória.
- [x] Validar admin temporário sintético, troca obrigatória, usuário comum sem administração, sessão após recarga, logout e revogação. Testes sintéticos não equivalem ao aceite humano.
- [x] Executar lint, typecheck, testes, build, integração com PostgreSQL/Redis descartáveis e smoke desktop/mobile. Fazer revisão independente e registrar evidências.

**Aceite:** login real protege a interface local; perfil exibido corresponde à sessão, pending não renderiza o produto e backend continua autoridade. Estoque permanece simulado. Nenhuma alteração em Preview/Production nesta fatia.

### E01.2 — Homologar acesso remoto (transporte preparado; ativação pendente)

**Spec:** fechar e aprovar SPEC-008 antes de implementar. **Arquivos candidatos:** configuração auth backend, `server/preview-*`, Function em `api/`, testes de transporte, Compose híbrido e documentação env.

- [x] Fechar transporte na mesma origem, origem canônica, cookies seguros, Set-Cookie, limites, CSRF e identidade verificada até a API; ensaio local conforme SPEC-008.
- [x] Preparar bootstrap/recuperação privados e modelo de credenciais exclusivas: [manutenção](../../operations/preview-access-maintenance.md). Ensaio local concluído; preenchimento de credenciais e execução remota dependem dos gates de backup/restore e autorização.
- [x] Escrever testes RED de transporte/isolamento, implementar opt-in remoto desligado e chegar a GREEN sem remover proteções locais.
- [ ] Ensaiar migração, backup/restore e rollback; publicar/migrar somente após autorização específica de Preview.
- [ ] Homologar HTTPS com dois perfis, cookies/sessões/revogação, proteção Vercel e diagnóstico; registrar revisão/deployment efetivos.

**Aceite:** auth Preview validada de ponta a ponta; Production não alterada. Perfis técnicos admin/user ainda não aprovam automaticamente permissões de catálogo/estoque.

## E02 — Persistência e recuperação

**Pré-requisito:** acesso homologado para o ambiente alvo. **Artefatos:** spec operacional própria, decisões de persistência/migrations e guia de backup/restore.

- [ ] Escolher mecanismo de persistência de negócio com base em transações, constraints e migrations necessárias; comparar opções apenas onde existir decisão material.
- [ ] Definir credenciais runtime/migration, destino efetivo por ambiente e comandos que recusam ambiente incorreto. Reaplicação e checksum devem preservar dados.
- [x] Acordar política de desenvolvimento: manual antes de cada migration, mínimo 30 dias/7 cópias, sem exclusão automática; meta RTO 1h e RPO anterior à migration, com perda possível entre backups. Aprovada pelo usuário em 24/10/2026.
- [ ] Definir responsável, destino/guarda externa de backup e gestão separada de chaves; não assumir que snapshot/arquivo vazio prova recuperação.
- [x] Implementar e testar backup/restore em destino descartável com conferência de conteúdo, revogação de sessões e ausência de escrita externa: [SPEC-009](../../specs/SPEC-009-access-backup.md), ensaio exclusivamente Docker local. Backup/restore do Neon ainda pendente.
- [ ] Definir rollback e runbook de incidente; validar antes de permitir dados importantes.

**Aceite:** esquema versionado e restauração comprovada, sem reset de volumes ou credenciais produtivas no local. Escolhas/custos pendentes são registrados antes de provisionamento.

## E03 — Produtos, variantes e SKUs

**Pré-requisito:** E02. **Spec nova:** RF-02, sem confundir SKU com anúncio externo. **Arquivos candidatos:** `apps/backend/src/catalog/`, migration de catálogo, contrato/testes de API, cliente React e tela de cadastro/consulta.

- [ ] Confirmar campos obrigatórios, produto simples/variantes, normalização/unicidade, renomeação/inativação e quem pode criar/consultar; usar exemplos sintéticos.
- [ ] Especificar endpoints de criação/consulta/edição e DTOs paginados; organização deriva do contexto autorizado, não de um campo arbitrário do cliente.
- [ ] Testar duplicidade concorrente, payload inválido, usuário sem permissão e vínculo entre produto/variante; depois implementar constraints e transações mínimas.
- [ ] Integrar a tela correspondente com estados de carregamento/vazio/erro/sucesso; retirar mocks apenas desse fluxo.
- [ ] Homologar criação → consulta → edição/inativação conforme regra aprovada, preservando identidade/histórico.

**Aceite:** catálogo persiste e reaparece após recarga, duplicidade é recusada e não há escrita em marketplaces. Saldo de estoque não é um campo livre do produto.

## E04 — Estoque e movimentações

**Pré-requisito:** E03. **Spec nova:** RF-03/RF-04 e invariantes do PRD. **Arquivos candidatos:** `apps/backend/src/inventory/`, migrations de saldo/histórico, formulário e tela de saldos existentes.

- [ ] Confirmar depósito inicial, saldo inicial, tipos/motivos, justificativa, operador e política de saldo insuficiente; margem depende de regra aprovada.
- [ ] Modelar fato imutável de movimentação e atualização transacional do saldo. Ajuste não apaga o passado; rejeitar edição direta de saldo sem evento.
- [ ] Testar concorrência, repetição de envio, rollback parcial, precisão/unidade e fórmula de disponibilidade aprovada antes de implementar.
- [ ] Integrar entradas/saídas/ajustes e saldos ao backend; mostrar sucesso somente após confirmação persistida. Histórico consulta fatos reais.
- [ ] Homologar saldo inicial, entrada, saída, ajuste zero, duplicidade e concorrência; conferir resultado após reiniciar serviços.

**Aceite:** saldo e histórico explicáveis/consistentes; nenhum recálculo visual altera silenciosamente o saldo remoto dos canais.

## E05 — Pedidos e reservas com provedores simulados

**Pré-requisito:** E04. **Spec nova:** estados e transições do pedido/reserva, demanda descoberta e expedição.

- [ ] Validar matriz de transições, instante de reserva, falta parcial, cancelamento, expedição/devolução e corte de operação; não copiar política de um marketplace para outro.
- [ ] Criar contrato interno dos adaptadores e fixtures sintéticas representativas, sem tokens reais.
- [ ] Implementar ingestão idempotente de pedido/evento, reserva e baixa transacionais; definir trabalho durável/inbox/outbox se a fatia exigir.
- [ ] Testar evento duplicado/fora de ordem, SKU sem vínculo, falta de estoque, cancelamento repetido e concorrência entre canais.
- [ ] Integrar pedidos/reservas e pendências às telas; separar leitura real de ações ainda simuladas.

**Aceite:** os mesmos eventos não reservam/baixam duas vezes; estados e pendências são auditáveis, sem tráfego real de marketplace.

## E06 — Marketplaces, primeiro leitura e depois escrita controlada

**Pré-requisito:** E05 e viabilidade oficial de cada canal. **Specs separadas por provedor e por leitura/escrita.** Artefatos: módulos `providers`, tentativas OAuth, armazenamento protegido, worker/retry e homologação.

- [ ] Confirmar documentação/requisitos atuais do Mercado Livre e Shopee, acesso disponível à conta piloto e ambientes de teste oficiais; escolher primeiro canal após essa verificação.
- [ ] Implementar autorização e renovação por biblioteca/contratos oficiais, correlação segura, proteção de credenciais e simuladores por padrão.
- [ ] Homologar somente leitura de contas, ofertas/variações e pedidos; vincular identidades externas a SKUs internos sem associação ambígua.
- [ ] Validar baseline, corte de pedidos e prévia de divergências antes de qualquer atualização externa de estoque.
- [ ] Implementar escrita como entrega separada, com trabalho durável, idempotência, limites/retry, pausa e reconciliação. Não assumir que Redis é a única cópia do trabalho.
- [ ] Liberar piloto pequeno somente com autorização explícita das contas/SKUs/efeitos, acompanhamento e caminho de recuperação. Não criar/editar conteúdo de anúncios no MVP.

**Aceite:** leitura homologada antes da escrita; conta errada, vínculo ambíguo ou credencial inválida mantêm escrita bloqueada. Expansão ao segundo canal exige o mesmo gate.

## E07 — Relatórios reais e observabilidade de uso

**Pré-requisito:** fatos persistidos das entregas anteriores. PostHog pode ser preparado em paralelo, mas envio depende de projeto confirmado.

- [ ] Definir métricas com fonte, elegibilidade de pedidos, período/fuso, moeda e cobertura. Distinguir indisponível de zero; não inferir audiência não fornecida oficialmente.
- [ ] Implementar consultas paginadas/agregadas e testes com cancelamento, reembolso e múltiplos canais; não somar definições incompatíveis.
- [ ] Substituir KPIs/gráficos fictícios pelas APIs de relatório e testar filtros/vazios/erros/períodos.
- [ ] Criar/confirmar projeto/região PostHog com o usuário; revisar catálogo de eventos técnicos/produto e limites de privacidade.
- [ ] Ativar ingestão somente após conferir sanitização, ausência de dados pessoais/credenciais/payloads e isolamento de ambientes; homologar eventos/dashboards de uso e falhas.

**Aceite:** relatórios explicáveis por fatos e cobertura; PostHog observa uso/diagnóstico sem virar a fonte de verdade de estoque/vendas.

## Registro de execução

Relatório desta primeira fatia: [integração de acesso local](../../operations/mvp-access-integration-2026-10-24.md). Demais entregas terão suas próprias specs e planos curtos, detalhados quando dependências e regras estiverem resolvidas. Não marcar uma entrega inteira como concluída porque sua parte local passou.
