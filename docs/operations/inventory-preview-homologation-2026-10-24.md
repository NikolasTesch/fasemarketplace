# Homologação do protótipo visual — 24/10/2026

## Escopo autorizado

Integrar as telas desenvolvidas em `codex/inventory-screens` na base `development` e homologar o Preview. O trabalho original estava sem commit e compartilhava o checkout com SPEC-007; a entrega foi isolada no worktree `inventory-homologation`, branch `codex/inventory-preview`, base `9bb869362cf814fca7908c5514a37e0ce4074fa3`.

Foram selecionados somente App/index, componentes/estilos/assets de inventory e referências/documentação Stitch. Backend, migrations, envs, configuração Docker e autenticação local não fazem parte do diff. O checkout original permanece preservado. Login remoto ainda depende da entrega própria, não deste protótipo.

## Comportamento

Seis telas com dados fictícios: estoque, pedidos/reservas, sincronização/alertas, histórico/auditoria, análise de vendas e movimentação. Ações simulam mudanças apenas na sessão de memória e são reiniciadas ao recarregar. Sem integração de negócio, download CSV real, persistência, escrita em Neon ou chamada de marketplace. O diagnóstico técnico continua GET `/api/health/ready` pelo gateway existente.

Regras em proposta permanecem identificadas. A homologação visual não aprova contratos de marketplace, métricas oficiais nem regras futuras de estoque. O aviso global informa o caráter de demonstração.

## Ajustes encontrados na revisão

- Navegação responsiva adicionada: a sidebar anterior desaparecia sem alternativa no celular.
- Grid de movimentação, gráficos e controles do painel analítico corrigidos para não transbordar a 390 px.
- Formulário do modal permite rolagem e acesso ao rodapé de confirmação.
- Saída simulada limitada ao saldo físico; ajuste aceita saldo zero, evitando truncamento silencioso da quantidade.
- Documentação corrigida: nenhum registro atômico real ou wrapper de auth publicado nesta entrega.

## Evidências locais

- `docker build --target verify -t fasemarketplace-inventory-verify .`: lint, typecheck, 55 testes (8 telemetry + 38 backend + 9 bridge) e build passaram.
- Build frontend repetido após ajuste CSS final: passou; sem novas dependências.
- Chromium desktop 1440 px e mobile 390 px: seis telas, cinco estados por tela, navegação, simulação de ajuste para zero, recusa de saída acima do saldo, modal e diagnóstico acessíveis; sem erros JS e sem requisições de mutação.
- Screenshots e resultado JSON sanitizados em `backups/inventory-homologation/` no checkout original, fora do Git.
- Gateway híbrido retomado e validado: sem chave 401; diagnóstico autenticado alcança API/Neon development e Redis. Túnel temporário exclusivo do Preview retomado; origem atualizada somente em Preview/development. Production não foi promovida nem reconfigurada.

## Publicação e aceite remoto

Registrar no relatório final o PR, commit de integração, deployment efetivo e resultado do smoke HTTPS. Checks/build locais não substituem essa verificação. Visitante sem autenticação Vercel deve continuar bloqueado; usuário autorizado deve ver o protótipo e o diagnóstico. Nenhuma promoção para main faz parte desta autorização.
