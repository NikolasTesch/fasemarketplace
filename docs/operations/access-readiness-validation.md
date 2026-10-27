# Validação de acesso — execução de 23/10/2026

Plano: [login e preparação do Preview](../superpowers/plans/2026-10-23-login-preview-readiness.md).

## Estado por tarefa

| ID | Estado | Evidência / próximo passo |
| --- | --- | --- |
| T01 | Em execução | Smoke local passou; banco tinha zero usuários. Usuário autorizou administrador genérico temporário. Bootstrap iniciado, ainda sem resultado confirmado; não divulgar credencial como válida antes de verificar. |
| T02 | Em execução | Snapshot isolado passou lint/typecheck, 56 testes e build. Integração e novo backup/restore iniciados, aguardando Docker. Smoke de navegador ainda não repetido neste ciclo. |
| T03 | Preparação parcial | Referências oficiais consultadas; rascunho da SPEC-008 preparado para discussão, sem aprovação. G1 ainda pendente. |
| T04–T08 | Não iniciadas | Dependem dos gates do plano. Sem migration Neon, publicação ou alteração de Production. |
| T09–T10 | Não iniciadas | Contexto de domínio/visual ainda não preparado neste ciclo. |

## Identidade do material verificado

- Checkout compartilhado observado em `codex/inventory-screens`, HEAD `9bb869362cf814fca7908c5514a37e0ce4074fa3`, com implementação de acesso sem commit e protótipo visual em paralelo.
- Snapshot: `backups/readiness-20261023214115`, ignorado pelo Git. Contém arquivos rastreados e a lista explícita de fontes de autenticação ainda não rastreadas; exclui a pasta não rastreada de telas `apps/web/src/inventory` e arquivos env privados.
- Manifesto SHA-256 por arquivo: `source-manifest.json` dentro do snapshot. A revisão Git sozinha não identifica o conteúdo testado, pois há alterações locais sem commit.
- Imagem gerada: `fasemarketplace-access-readiness-verify`; manifest list `sha256:0533b8aa4abf3471ab4624bedf39b72af5348adac8726e877e0b9b8b10297391`.

## Evidências confirmadas

1. `pwsh -NoProfile -File scripts/verify-local.ps1`: exit 0; postgres/redis/api/worker/web saudáveis e proxy local pronto.
2. Consulta local sanitizada: zero usuários, zero administradores, zero administradores prontos antes do bootstrap. Não foi consultada identidade pessoal.
3. `docker build --target verify -t fasemarketplace-access-readiness-verify <snapshot>`: exit 0; lint, typecheck, 8 testes de telemetria + 39 de backend + 9 de ponte = 56, além de build backend/web.
4. Nenhum arquivo de tela, segredo, Compose ou código de aplicação foi editado neste ciclo até este registro. Foi criada uma cópia para validação, sem trocar branch, fazer stash ou commit.

## Ocorrência operacional

Após o build, comandos Docker subsequentes ficaram sem resposta, inclusive `docker ps`. Consultas HTTP com timeout de quatro segundos também não receberam resposta das APIs em 4174, 4274 e 4474. A causa ainda não foi determinada; não atribuir a falha ao código, ao usuário ou ao Docker Desktop sem diagnóstico.

Não reiniciar Docker/WSL automaticamente: isso afeta também Production e outros projetos. Foi solicitada ao usuário a informação do estado exibido pelo Docker Desktop. Não registrar bootstrap, integração ou backup como concluídos por terem sido iniciados.

## Decisões registradas

- **Ruling:** executar verificações técnicas independentes enquanto a homologação humana está pendente, sem declarar G1 aprovado. Isso permite progresso sem confundir teste automático e aceite do usuário.
- **Ruling:** usar snapshot ignorado para validar a implementação de acesso sem trocar a branch das telas. Não há nova implementação de aplicação neste ciclo; se T05 for autorizada, isolar o checkout antes de editar fontes.
- **Ruling:** conta genérica foi explicitamente autorizada pelo usuário. Ela será somente local e deverá exigir troca da senha provisória. Não registrar sua senha neste relatório ou em arquivos versionados.
- **Ruling:** antecipar apenas pesquisa e rascunho técnico de T03 enquanto G1 está pendente. Não tratar o rascunho como decisão arquitetural, aprovação ou autorização de implementar/ativar Preview.

## Próximas verificações

- Confirmar estado do Docker e resultado dos comandos pendentes, evitando bootstrap duplicado.
- Confirmar administrador local criado com troca obrigatória; validar login/sessão/logout e preservar a senha provisória até o usuário substituí-la.
- Concluir integração, backup/restore com contagem/hash sanitizados e smoke de navegador em sequência.
- Atualizar checklist do plano com evidências e levar a SPEC-008 para decisão após G1.
