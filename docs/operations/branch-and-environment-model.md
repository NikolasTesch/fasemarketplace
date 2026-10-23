# Modelo de branches e ambientes

**Estado:** ambiente local preparado por autorização em 23/10/2026; Preview e Produção permanecem pendentes de arquitetura e aprovação.  
**Estado do checkout:** base `development` para integração; remoto GitHub `origin` configurado. A publicação do código não provisiona ambientes nem recursos de aplicação. Compose e aplicações de bootstrap presentes.

## Princípios

- A mesma mudança percorre ambientes em ordem: Docker local → `development`/Preview protegido → `main`/Produção, após os gates aplicáveis.
- O ambiente executado pelo Docker usa recursos locais. Não conecta aos bancos, filas, storage ou credenciais de ambientes remotos.
- Uma branch Git não determina por si só quais dados, credenciais ou efeitos externos estão ativos; a configuração efetiva deve ser verificada.
- Preview e Produção não serão considerados desenhados ou configurados até suas decisões de isolamento e recuperação serem concluídas em etapa própria.

## Decisão posterior: desenvolvimento híbrido

Em 23/10/2026 o usuário escolheu frontend Vercel, API/worker Docker e PostgreSQL Neon remoto, com Redis local. Ele criará os recursos manualmente. Ver [guia híbrido](hybrid-development.md) e [SPEC-003](../specs/SPEC-003-hybrid-development.md). Essa escolha substitui abaixo o estado de provedores não escolhidos, mas não significa ambientes já provisionados. Docker padrão permanece local; o Compose híbrido aceita somente development. Production fica reservada, sem backend produtivo/deploy autorizado nesta etapa.

## Mapa faseado

| Elemento | Intenção proposta | Estado |
|---|---|---|
| Trabalho local | Docker Compose executa web, API, worker, PostgreSQL e Redis; sem chamadas de marketplace | Bootstrap implementado; funcionalidades e fixtures de negócio pendentes |
| Branch de tarefa | `codex/<nome>` parte da `development` atualizada e contém uma unidade revisável | A criar para cada unidade |
| Integração | `development` recebe tarefas revisadas e aprovadas | Base inicial do bootstrap |
| Preview | Deploy protegido da integração para homologação com dados, credenciais, storage e callbacks isolados | Adiado; topologia e provedor não escolhidos |
| Produção | `main` representa código liberado, com operação externa explicitamente controlada | Adiado; destino e processo de release/rollback não escolhidos |

`development` é a base local de integração publicada em `origin`; criar branches de tarefa a partir dela após atualizá-la. `main` fica reservada ao fluxo futuro de release. Não criar projetos remotos, bancos ou deployments com base nestes nomes.

## Limites do Docker local

### Recursos

- PostgreSQL local mantém estado e trabalho durável.
- Redis local atende a execução das filas e pode ser reconstruído do estado durável quando necessário.
- API e worker rodam como processos separados no Compose, compartilhando código e domínio.
- Adaptadores de Mercado Livre e Shopee apontam para simuladores locais por padrão.

Web, API, worker, PostgreSQL e Redis estão configurados na [SPEC-000](../specs/SPEC-000-local-bootstrap.md); versões, portas e comandos no [README](../../README.md). Worker mantém apenas heartbeat. Adaptadores/simuladores funcionais, filas de negócio e reconstrução de tarefas ainda serão implementados. O modo permitido no bootstrap é somente `mock`.

### Dados e integrações

- Fixtures locais devem ser sintéticas, pequenas, repetíveis e sem dados pessoais reais.
- O ambiente deve inicializar e validar fluxos sem conta real, token de vendedor ou endpoint remoto.
- Chamadas reais de escrita em marketplaces ficam desabilitadas por padrão. Qualquer futura homologação com sandbox será especificada e autorizada separadamente.
- Segredos locais ficam em arquivos ignorados pelo Git; `.env.example` contém somente valores fictícios.
- Não apontar Compose para banco, Redis, storage, webhook ou credencial de Preview/Produção.

### Rede

- Interfaces necessárias ao desenvolvedor ficam vinculadas ao loopback.
- Portas de PostgreSQL e Redis não são publicadas no host por padrão.
- A configuração local não aceita destino arbitrário de provider para evitar que uma configuração incorreta envie tráfego à conta real.

## Modelo futuro de Preview

Planejar somente após aprovar a arquitetura local:

- identidade do provedor e do projeto de deploy;
- gatilho de deploy e branch associados;
- banco, fila e armazenamento isolados da Produção;
- acesso protegido, segredos exclusivos e dados sintéticos;
- credenciais de sandbox e URLs de webhook de homologação;
- bloqueio técnico de operações reais de estoque/anúncio;
- regras de retenção, limpeza e observabilidade.

Preview não poderá usar credenciais de Produção nem dados reais por conveniência. Se algum dado real for considerado necessário, definir autorização, minimização e isolamento antes de carregar qualquer cópia.

## Modelo futuro de Produção e recuperação

Definir numa etapa posterior, após decidir hospedagem e operação:

- destino efetivo da aplicação, bancos, filas, storage e webhooks;
- pipeline de promoção `development` → `main` e revisão/aprovação;
- estratégia de migration compatível e ensaio prévio;
- frequência, retenção, criptografia e verificação de backups;
- restauração ensaiada, RPO/RTO aprovados e preservação de rollback;
- reconciliação dos estados externos após recuperar PostgreSQL, filas ou aplicação;
- gates de retomada de publicação para reduzir risco de estoque incorreto ou chamadas duplicadas.

Ter um arquivo de backup ou um deploy pronto não comprova que a recuperação funciona. Não executar publicação, migration ou escrita em marketplace em Produção antes de definir e aprovar o procedimento correspondente.

## Regras de transição

1. Validar e revisar o bootstrap do Docker local conforme SPEC-000 antes das próximas funcionalidades.
2. Depois de fechar a arquitetura local, definir o isolamento de Preview e a promoção/recuperação de Produção antes de configurar esses ambientes.
3. Manter arquitetura, base teórica e apresentação coerentes com as specs; a autorização atual cobre o bootstrap local do MVP.
4. Depois da autorização de desenvolvimento, validar cada unidade em Docker antes de integrá-la em `development`.
5. Homologar o isolamento de Preview antes de depender dele como gate de release.
6. Ensaiar backup, recuperação e promoção antes de autorizar a primeira operação produtiva.

