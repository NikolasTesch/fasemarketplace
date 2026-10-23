# SPEC-001 — Frontend React com Vite

Data: 23/10/2026. Mudança solicitada pelo usuário: substituir SvelteKit por React com Vite para utilizar tecnologias familiares em um produto potencialmente produtivo.

## Desenho e escopo

`apps/web` passa a ser uma SPA React com TypeScript e Vite. A API e o worker continuam no NestJS; PostgreSQL, Redis, dados, portas locais e regras de isolamento são preservados. Não há alteração de domínio nem integração PostHog nesta tarefa.

O navegador chama `/api/health/ready` na mesma origem da interface. No Docker local, o proxy de desenvolvimento do Vite remove `/api` e encaminha ao serviço `api:3001`. Não expor nomes internos Docker ao navegador nem incluir credenciais do banco no frontend. Esse proxy é exclusivo de desenvolvimento; o build estático precisará de roteamento `/api` para NestJS no futuro ambiente aprovado.

A página preserva o diagnóstico técnico e apresenta três estados: verificando, disponível e indisponível. O healthcheck da web verifica a entrega do HTML; o smoke separado verifica o caminho web → proxy → API → dependências. Um HTML 200 isolado não comprova execução do React.

## Critérios de aceite

- [x] React/Vite substituem código, dependências e configuração Svelte no frontend ativo.
- [x] Typecheck, lint, testes existentes e build funcionam por instalação limpa no Docker.
- [x] Interface React carrega no navegador e consulta a API pelo proxy local.
- [x] Falha da API/dependências aparece como indisponibilidade, sem falso positivo no smoke.
- [x] Alterações em fontes React são detectadas pelo Vite no Docker/Windows.
- [x] Cinco serviços permanecem saudáveis; dados e containers de banco/Redis não são recriados pela migração.
- [x] README, arquitetura e orientações refletem a decisão atual; evidências históricas ficam identificadas.

## Plano

1. Substituir `apps/web` por React, entrada HTML, TSX, CSS e configuração Vite com proxy e polling.
2. Atualizar lockfile e lint; adaptar healthcheck, montagens e smoke ao frontend SPA.
3. Validar instalação limpa e checks no Docker; reconstruir web e atualizar os processos API/worker para a imagem npm compartilhada, sem recriar PostgreSQL/Redis.
4. Conferir interface, proxy, estado de falha e atualização de código; revisar documentação e alterações.

## Limites de produção

Usar versões estáveis, sem React Compiler experimental. `vite dev` e `vite preview` não são servidores de produção. A futura publicação deve servir `dist/` por servidor estático, definir roteamento da API, autenticação e demais gates já previstos. Esta troca não configura hospedagem nem comprova prontidão produtiva.

## Evidências em 23/10/2026

- React/React DOM 19.3.1, Vite 8.3.5 e plugin React 6.1.2 instalados com lockfile. Svelte e pacotes `@sveltejs` ausentes dos manifests ativos e lockfile.
- `docker build --target verify -t fasemarketplace-local-verify .` aprovado: `npm ci`, ESLint, TypeScript, 13 testes de backend e build. Frontend gera `dist/index.html` e assets estáticos.
- `scripts/verify-local.ps1` aprovado: cinco serviços saudáveis, portas loopback, rede interna preservada, entrada HTML React e JSON da API pelo proxy.
- Playwright/Chromium headless confirmou renderização React com a API real, estado indisponível mediante resposta HTTP 503 simulada no navegador e recuperação após remover a simulação. Nenhum erro JavaScript não tratado.
- Alteração temporária no título React refletida no navegador sem rebuild ou reinício dos containers; fonte revertida e título original confirmado.
- PostgreSQL e Redis mantiveram os mesmos IDs de container antes/depois; nenhum volume ou dado foi removido. API/worker atualizados por compartilharem a imagem de desenvolvimento do workspace.
- Revisão independente sem achados materiais. Nenhum commit, remoto, publicação ou integração PostHog nesta tarefa.

Limites: o teste 503 intercepta somente a requisição do navegador e não interrompe a API real. O smoke por PowerShell verifica o proxy, enquanto os testes de navegador verificam a renderização. Estes testes não homologam regras de estoque nem publicação em Produção.
