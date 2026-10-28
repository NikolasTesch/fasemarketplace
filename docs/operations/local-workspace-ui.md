# Área local sem simulações — 27/10/2026

SPEC-012 implementada por pedido direto do usuário, seguindo sua referência de Usuários. Ele confirmou que movimentações físicas reais ficam para a próxima entrega. Continuação local da branch `codex/basic-catalog`; sem commit, publicação, migration ou operação remota.

## Comportamento

**Atualização posterior — 27/10/2026:** os bullets abaixo registram o estado homologado da SPEC-012 naquele momento. A entrega local posterior de estoque físico e a ativação na branch `development` estão descritas em [physical-inventory.md](physical-inventory.md) e substituem a indisponibilidade antiga de estoque/movimentações. A carga atual de visualização contém 10 produtos, 23 SKUs, 500 unidades sintéticas e mínimos por SKU somando 100; não há unidades alocadas a marketplaces.

- A barra de acesso anterior foi removida. A navegação da stack local começa por Estoque físico, seguida de Movimentações, Histórico de movimentações e Catálogo. Gate de login e troca obrigatória permanecem anteriores ao shell.
- Usuários integra o menu e concentra cadastro, consulta, bloqueio/desbloqueio e redefinição existentes. A troca da própria senha continua nessa seção, inclusive para usuário comum, que não recebe controles administrativos.
- Atualização solicitada em 27/10: formulário de cadastro aparece somente no modal aberto por **Cadastrar usuário**, no cabeçalho à direita. A tela mostra a equipe sem o formulário. O botão **Trocar minha senha** foi removido; a função continua recolhida em **Segurança da conta**.
- Layout usa formulário em cartão e equipe em linhas conforme referência. Somente perfis Administrador/Usuário e ações suportadas; edição de perfil e perfis Dono/Supervisor/Vendedor não foram inventados. Busca identifica explicitamente que filtra a página atual de 20 registros.
- Sair fica junto ao perfil real no cabeçalho. Lançar Movimentação aparece uma vez, em vermelho abaixo da marca na lateral; em mobile, o mesmo bloco se adapta ao topo.
- Produto tem ícone decorativo, cabeçalho separado e variantes agrupadas. Novo produto, edição de produto, nova/edição de variante, senha e redefinição abrem modais com título/contexto. Escape/Tab e retorno de foco testados; fechamento bloqueado durante gravação; erros preservam o formulário.
- Não há mais rotas ativas/imports de pedidos, sincronização, analytics ou simulação de movimentação em App.tsx. Contadores, depósito/operador fictícios e confirmação falsa de movimentação foram retirados. Arquivos do protótipo permanecem no repositório como referência, sem participar da interface ativa.
- Estoque e histórico mostram indisponibilidade explícita, sem inventar saldo zero. O botão de movimentação explica que o registro ainda não está disponível. Catálogo continua com os registros persistidos existentes (3 produtos/6 variantes); nada foi apagado ou convertido em saldo.
- A tela de Estoque explica que o saldo está indisponível porque ainda não existem modelos, endpoints, saldo inicial ou lançamentos de estoque. A tela Movimentações também é apenas informativa; não grava entradas, saídas ou ajustes.
- Configurações aparece na lateral apenas no ambiente com catálogo local habilitado. Shopee e Mercado Livre mostram que API, webhook e validação não estão configurados; validar permanece desabilitado até existir integração real no backend. A tela não guarda credenciais, consulta marketplaces nem afirma recebimentos inexistentes.
- Ambientes sem catálogo habilitado abrem diagnóstico; nenhuma mudança remota foi publicada.

## Validação

1. `scripts/verify-workspace-ui.mjs`: contratos de interface com HTTP sintético restrito ao navegador de teste. RED inicial confirmou a barra antiga; GREEN cobre navegação, ausência de mocks visíveis, admin/user/provisório, modais, conflito/rascunho, Escape/Tab/foco, indisponibilidade de movimentação e mobile. Essas fixtures não fazem parte do runtime do produto.
2. `scripts/verify-access-ui.mjs`: homologação com API e PostgreSQL locais reais. Cadastro de usuário, troca provisória, persistência de sessão, bloqueio/revogação, desbloqueio, redefinição, logout, cookie HttpOnly, ausência de browser storage e mobile passaram.
3. Ensaio real adicional: catálogo → editar produto em modal → salvar → Usuários → mobile → abrir/cancelar variante → sair. Sem erros de renderização/overflow; 3 produtos/6 variantes preservados. Capturas privadas em `backups/catalog/workspace-*.png`.
4. Revisão independente identificou cancelamento de reset durante POST e perda de foco após edição bem-sucedida. Ambos reproduzidos por testes RED e corrigidos: Cancelar desabilitado durante busy; lista da mesma consulta permanece montada durante refresh, preservando o acionador/foco. Nenhum achado adiado.
5. Imagem `fasemarketplace-workspace-ui-verify`, target `access-maintenance`: lint, typecheck, suíte regular e build. Execução concluída com sucesso. Nenhuma dependência nova foi adicionada.

Execução dos testes de navegador exige Playwright disponível no host, sem adicionar dependência ao produto:

```powershell
# Configurar PLAYWRIGHT_MODULE e PLAYWRIGHT_CHROMIUM_EXECUTABLE com os caminhos locais.
node scripts/verify-workspace-ui.mjs
# Para ensaio real, ACCESS_UI_FIXTURE aponta ao JSON privado de uma conta sintética
# de administrador, com origin, email, password, name e cookiePrefix.
node scripts/verify-access-ui.mjs
```

Contas técnicas usadas nos testes foram bloqueadas e suas sessões revogadas; usuários de ensaio recém-criados também ficaram bloqueados/pendentes. A conta do usuário e sua sessão ativa foram preservadas. O administrador de entrega já havia concluído sua troca de senha: não foi redefinido nesta entrega e o arquivo inicial de senha provisória pode não representar mais sua senha atual.

Os guias anteriores descrevem evidências do momento da SPEC-011; este documento substitui a apresentação anterior da navegação e os avisos de demonstração na interface ativa. Próxima entrega exige especificar e validar entradas, saídas, ajustes e saldos reais.
