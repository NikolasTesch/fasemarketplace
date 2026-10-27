# SPEC-012 — Navegação local e edição em modais

Pedido direto do usuário em 27/10/2026, acompanhado de referência visual para Usuários. Evolução da SPEC-011 somente local, sem novas regras de estoque ou permissões.

- Remover a barra de acesso redundante. A navegação principal inicia em Estoque físico; sessão e troca obrigatória continuam como gates.
- Usuários na navegação lateral: cadastro e lista em cartões conforme referência, busca nos registros da página, bloqueio e redefinição existentes. Cadastro fica em modal aberto pelo botão à direita no cabeçalho, antes da equipe. Não mostrar o botão “Trocar minha senha”; manter acesso à troca recolhido em “Segurança da conta”. Manter apenas Administrador/Usuário; não inventar Dono/Supervisor/Vendedor nem edição de perfil sem contrato.
- Sair ao lado do perfil no cabeçalho principal; única ação vermelha de movimentação logo abaixo da marca na lateral, acessível também em telas pequenas.
- Catálogo com ícone decorativo e separação de produtos/variantes. Criar/editar produto e variante em dialog modal nativo: foco contido, Escape, fechamento, retorno do foco ao acionador; bloquear fechamento durante gravação. Erros permanecem visíveis no modal; fechar descarta apenas rascunho, nunca dados persistidos.
- Retirar das rotas e navegação os exemplos de sincronização/pedidos/relatórios e quaisquer contadores, depósitos ou operadores fictícios. Nenhuma simulação pode informar gravação realizada. Estoque e histórico sem endpoint real mostram indisponibilidade explícita, sem assumir saldo zero.
- Configurações na navegação local apresenta Shopee e Mercado Livre, separando estado da API, webhook e última validação. Sem configuração ou fonte real de estado, exibe pendência e mantém a ação de validar desabilitada; não coleta credenciais nem reporta sucesso fictício.
- Usuário confirmou: reorganizar agora, movimentações físicas reais na próxima entrega. Nenhuma regra de saldo ou mutation simulada será introduzida nesta fatia.
- Ordem da navegação atualizada por pedido em 27/10: Estoque físico, Movimentações, Histórico de movimentações e Catálogo. Estoque começa sem saldos porque a persistência atual contém somente catálogo; não mostrar zero como se fosse saldo real.

Implementação preserva React, API de acesso e catálogo existentes, sem dependências novas. Escolha técnica: compartilhar um dialog nativo em vez de manter formulários inline ou criar uma biblioteca de overlays; menos código e comportamento de teclado do navegador. Não ampliar backend, Functions, dados remotos, migrations ou publicar.

Aceite: ausência da barra anterior e de dados simulados; catálogo inicial; usuários e troca de senha no shell; logout junto ao perfil; uma ação de movimentação na lateral; modais acessíveis com contexto/erros; admin/user/pending preservados; layout desktop/mobile sem overflow; lint/typecheck/build e teste de navegador.
