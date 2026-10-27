# Reorganização da área local — plano de implementação

Execução inline do pedido visual detalhado do usuário. Spec: [SPEC-012](../../specs/SPEC-012-local-workspace-ui.md). React/Vite, contexto de acesso existente e dialog HTML nativo; sem dependências, migrations ou publicação.

## T1 — Navegação e conta

- [x] Teste navegador RED: barra access-header ausente, botão Usuários lateral, logout junto ao perfil e nenhum contador/mock.
- [x] Access.tsx: contexto de ações logout/refresh; gate provisório preservado; AccessSettings/Users no shell e senha em modal. Shell.tsx: Catálogo inicial, Usuários, Estoque/histórico/diagnóstico; ação vermelha única abaixo da marca; mobile acessível.
- [x] Usuários: cartões/formulário conforme referência, busca explicitamente na página, estados de carregamento/erro, sem inventar endpoints/perfis; redefinição em modal.
- [x] App.tsx: retirar execução/imports de telas com mocks; estoque e histórico indisponíveis até integração real; remover sucesso fictício de movimentação.

## T2 — Modais de catálogo

- [x] Dialog.tsx: título acessível, showModal, foco/retorno/Escape e bloqueio durante gravação; contexto do produto editado visível.
- [x] CatalogScreen/CatalogForms: formulários em modal, erro junto ao formulário; ícone por produto e separação visual.
- [x] Navegador GREEN: editar/salvar, cancelar sem gravação, Escape/Tab/retorno de foco, conflito/erro mantém rascunho, mobile sem overflow.

## T3 — Verificação e documentação

- [x] Docker lint/typecheck/test/build; validar acesso admin/user/provisório e logout sem exibir senha; não alterar conta de entrega para testes.
- [x] Revisar diff/segredos e documentar evidências/limites, incluindo decisão confirmada de adiar movimentações reais.
