# Fluxo de desenvolvimento e entrega

**Estado:** Docker local e Preview protegido configurados; backend Production Docker isolado ativo/validado pela [SPEC-006](../specs/SPEC-006-production-docker.md), com ponte Vercel ativada após promoção explícita; ver [registro da publicação](production-release-2026-10-23.md).
**Escopo:** fluxo de entrega. A [matriz de ambientes](environment-configuration.md) registra configuração atual e proposta; backup, autenticação e operação de negócio continuam pendentes.

## Objetivo

**Decisões posteriores (23/10/2026):** o usuário escolheu Vercel + Docker + Neon, ativou o Preview protegido (SPEC-005) e aprovou backend Production em outra stack Docker (SPEC-006). O diagnóstico HTTPS está validado, mas a promoção técnica foi concluída com autorização; autenticação de produto e gates de operação real continuam pendentes.

Adotar o ciclo usado no Fasemento — validar localmente, integrar em `development`, homologar em Preview e promover a `main`/Produção após aprovação — com proteções ajustadas ao risco do FaseMarketplace. O sistema poderá alterar estoque e anúncios em serviços externos; por isso, chamadas reais devem ficar fora do caminho local padrão e exigir uma etapa de homologação separada.

## Etapa atual: bootstrap local do MVP

O usuário autorizou a preparação do ambiente local e escolheu React + Vite + NestJS com TypeScript (SPEC-001). Existem Compose, API, worker, web e a base `development` publicada em `origin`. A publicação do repositório não configura deployments ou recursos remotos da aplicação. A sequência é:

1. Validar a infraestrutura local conforme README e SPEC-000.
2. Concluir primeiro os ambientes e a promoção explicitamente aprovada; depois avançar em funcionalidades por specs pequenas, resolvendo regras de domínio antes do código.
3. Manter a arquitetura, base teórica e apresentação alinhadas ao que está implementado e ao que segue proposto.
4. Definir isolamento de Preview, promoção, backup e recuperação antes de configurar ambientes hospedados, mediante autorização específica.

A autorização posterior permite preparar Production técnica conforme SPEC-006. Isso não autoriza funcionalidades, workflows adicionais, promoção automática para main ou operações reais de marketplace.

## Ciclo proposto por mudança

Após o usuário autorizar a implementação e o Git estar configurado:

1. **Descobrir:** ler a spec, o contexto de domínio, esta política e os componentes/testes relacionados; conferir alterações locais e branches.
2. **Especificar e planejar:** dividir o trabalho em uma fatia pequena com comportamento, limites, falhas e critérios de aceite verificáveis.
3. **Implementar em isolamento:** criar uma branch `codex/<nome-da-tarefa>` a partir de `development` atualizada; usar worktree quando isso ajudar a preservar trabalho paralelo.
4. **Validar localmente em Docker:** executar migrações e fixtures sintéticas no banco descartável/local, verificar API e worker, persistência, reinicialização e falhas relevantes. As integrações externas usam simuladores por padrão.
5. **Revisar:** conferir diff, regras de domínio, segurança, idempotência e evidência para cada critério de aceite.
6. **Integrar em `development`:** abrir PR da branch da tarefa para `development`; merge requer autorização/aprovação explícita e os checks configurados. Não desenvolver diretamente em `development` ou `main`.
7. **Homologar em Preview protegido:** usar o ambiente existente para diagnóstico; funcionalidades futuras precisam validar seus próprios dados, credenciais, callbacks e efeitos. A aprovação local não vale como aprovação de Preview.
8. **Promover para Produção:** de `development` para `main` por PR/release revisado e aprovado. A aprovação de configuração ou Preview não autoriza escrita externa, migração ou publicação em marketplace por si só.

Proposta herdada do fluxo existente: manter no máximo um PR de promoção aberto para `main` por vez; PRs de tarefa para `development` podem seguir o limite que vier a ser aprovado para este repositório. Confirmar a política quando o GitHub for configurado.

## Arquitetura local e evolução

O Compose local oferece web React/Vite, API e worker NestJS, PostgreSQL e Redis isolados. A arquitetura de negócio continua prevendo:

- processo da API e processo worker com o mesmo domínio;
- PostgreSQL como fonte durável para estoque, reservas, inbox/outbox e tarefas;
- Redis/BullMQ como mecanismo recuperável de execução, reconstruível a partir do estado persistido;
- adaptadores Mercado Livre e Shopee com simuladores selecionáveis para desenvolvimento.

Critérios do ambiente local, implementados ou a completar nas specs de negócio:

- iniciar dependências de forma explícita e aguardar healthchecks/readiness antes de declarar o sistema pronto;
- manter portas de interface vinculadas ao loopback e não expor banco/Redis na rede do host por padrão;
- persistir dados locais em volumes nomeados e documentar claramente qualquer operação que os destrua;
- carregar configuração a partir de exemplos sem segredos e de arquivos locais ignorados pelo Git;
- iniciar sem credenciais de marketplace, sem chamadas de escrita externa e sem depender de banco remoto;
- fornecer fixtures sintéticas reprodutíveis e uma forma documentada de observar logs/correlation IDs;
- distinguir a saúde da API, do worker, do PostgreSQL, do Redis e dos simuladores.

Stack e comandos estão definidos no README e na SPEC-000. Imagens são fixadas por digest; os serviços são `web`, `api`, `worker`, `postgres` e `redis`. Ainda não existem fixtures de negócio, correlação de jobs, providers, ORM ou migrations. Provedor de hospedagem e backup remoto permanecem pendentes.

## Gatilhos e finalidade do CI futuro

Quando a aplicação e o GitHub forem inicializados, o CI deverá validar código proposto sem acessar ambientes produtivos:

- testes de unidade e integração com PostgreSQL/Redis locais ou descartáveis;
- lint, typecheck e build, conforme stack aprovada;
- validação de migrações em banco descartável;
- checagem de documentação e da política de branch/PR;
- verificações de segredo e dependências conforme harness escolhido.

O CI não deve publicar estoque/anúncios, acessar contas de vendedor nem reutilizar credenciais de Produção. Checks verdes atestam somente os comandos realmente executados; não substituem homologação funcional.

## Gates futuros de Preview e Produção

Definir estes detalhes em uma etapa posterior, depois de concluída a arquitetura local:

- provedor de hospedagem e topologia de API/worker/webhooks;
- ambiente de Preview protegido, banco separado e dados sintéticos ou explicitamente autorizados;
- aplicações/contas sandbox e credenciais isoladas por ambiente;
- bloqueio de publicação externa e mensagens em Preview;
- migrations ensaiadas, backup/restore, monitoramento e plano de rollback;
- aprovação específica antes de escrita real de estoque/anúncios e reconciliação após retomada.

Nenhuma dessas escolhas está efetivada por este documento. A lista serve como limite e roteiro para a futura etapa, não como autorização operacional.

