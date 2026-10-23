# SPEC-004 — Frontend conectado ao desenvolvimento com Neon

## Objetivo e desenho

Completar localmente o fluxo React → API Docker → Neon já escolhido pelo usuário. O Compose híbrido passa a servir também a web em `127.0.0.1:4273`, com proxy `/api` para sua própria API. O Compose totalmente local segue em 4173 sem alterações. API, worker e Redis híbridos existentes são preservados.

O frontend recebe somente metadados públicos, sem URL/credenciais PostgreSQL ou Redis. Sua tela de diagnóstico informa que é desenvolvimento híbrido com Neon. Os estados loading/ready/unavailable e a atualização manual continuam funcionando. O rótulo identifica a configuração da web; a prontidão é comprovada pela chamada à API, não pelo rótulo.

## Limites

Sem túnel público, deploy Vercel, autenticação de produto, migrations, jobs ou integrações de marketplace. A publicação continua dependente da definição de acesso HTTPS protegido. Não modificar a branch de produção do Neon nem apagar volumes.

## Aceite

- Web híbrida em 4273 e API híbrida em 4274, somente loopback; Redis/worker sem portas publicadas.
- A web não recebe variáveis de banco/Redis nem a conexão Neon em seu ambiente.
- Diagnóstico via `/api/health/ready` confirma PostgreSQL e Redis disponíveis, com modo mock.
- Navegador renderiza React, mostra ambiente híbrido, permite atualizar e lida com falha temporária da API.
- Web 4173 continua identificada como ambiente local, conectada à API local.
- Smoke específico reexecutável e documentação com endereços/comandos atuais.

## Verificação prevista

Smoke híbrido falha inicialmente por ausência do serviço web; passa depois da configuração. Rodar checks existentes, smoke local e browser com falha de API simulada e recuperação por atualização manual. Sem enviar telemetria ou criar dados de negócio.

## Evidência de execução — 23/10/2026

- Smoke inicialmente falhou com `Missing hybrid web service`; após implementar, passou para Redis/API/worker/web e proxy → Neon.
- Smoke totalmente local passou; ambiente 4173 preservado.
- Playwright/Chromium confirmou renderização, rótulo híbrido, atualização manual, estado indisponível após 503 interceptado e recuperação após remover a interceptação. Nenhuma requisição externa do navegador ou erro React; screenshot inspecionada. Essa simulação não interrompeu API, worker ou Neon reais.
- No container: lint, typecheck, 43 testes e build passaram. Revisão independente sem achados importantes.
- `.env` recebeu somente HYBRID_WEB_PORT se ausente; segredos existentes preservados e ignorados pelo Git. Nenhum commit, push, deploy, túnel ou escrita de negócio.
