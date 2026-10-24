# Telas do Google Stitch — Fase Estoque & Marketplace

**Data de extração e implementação:** 23/10/2026
**Branch de trabalho:** `codex/inventory-screens`
**Projeto Stitch:** Inventory Management System Screens (`1227463124628421412`)

---

## 1. Telas Extraídas e Arquivos Locais

Todas as 6 telas solicitadas tiveram seu código HTML original e screenshots PNG baixados e armazenados em `docs/stitch/`:

| # | Tela no Stitch | ID da Tela | Arquivo HTML | Imagem PNG |
|---|---|---|---|---|
| 1 | **Fase Estoque — Painel Analítico de Vendas** | `98f34dee77fe44fda9d2155940824b0b` | `docs/stitch/01-painel-analitico-vendas.html` | `docs/stitch/01-painel-analitico-vendas.png` |
| 2 | **Fase Estoque — Pedidos e Reservas** | `d9f801b02e1b4f7991fdd951a69c62aa` | `docs/stitch/02-pedidos-reservas.html` | `docs/stitch/02-pedidos-reservas.png` |
| 3 | **Fase Estoque — Sincronização e Alertas** | `e774e76bb36c444c94d0c6a7adb03d8a` | `docs/stitch/03-sincronizacao-alertas.html` | `docs/stitch/03-sincronizacao-alertas.png` |
| 4 | **Fase Estoque — Histórico e Auditoria** | `19ddac71d0194f11af78589372e833f9` | `docs/stitch/04-historico-auditoria.html` | `docs/stitch/04-historico-auditoria.png` |
| 5 | **Fase Estoque — Estoque e Saldos** | `31ba50e050c4479f8b3c402212e26fe5` | `docs/stitch/05-estoque-saldos.html` | `docs/stitch/05-estoque-saldos.png` |
| 6 | **Fase Estoque — Lançar Movimentação de Estoque** | `2a6143c8302a424b9c6768340c3bdb36` | `docs/stitch/06-lancar-movimentacao.html` | `docs/stitch/06-lancar-movimentacao.png` |

---

## 2. Arquitetura da Implementação em React + Vite + TypeScript

As telas foram integradas no workspace `apps/web` com TypeScript estrito, fidelidade visual a `docs/design.md` e conformidade com o domínio do `prd.md`:

### Componentes e Telas (`apps/web/src/inventory/`)
- **`types.ts`**: Definições dos tipos do domínio (`SkuStockItem`, `OrderReservation`, `ChannelSyncInfo`, `StockDiscrepancy`, `AuditMovement`, `SalesKpiMetrics`, `ScreenState`).
- **`mock-data.ts`**: Conjunto de dados sintéticos coerentes refletindo as métricas do piloto (Depósito Itaquera, 3.420 un físicas, 284 un reservadas, 120 un margem, 3.016 un disponíveis).
- **`inventory.css`**: Estilização baseada nos tokens corporativos (`--brand: #c9151b`, `--brand-dark: #a51117`, `--border: #e2e2e8`, cards com faixa superior vermelha 36x3px, sidebar de 236px, topbar translúcida com blur, tipografia Inter e ícones Material Symbols Outlined).
- **`components/Shell.tsx`**: Shell da aplicação contendo sidebar de navegação com logotipo oficial Fase Sport, topbar com badge de ambiente dinâmico (`Desenvolvimento Local`, `Híbrido`, `Preview` ou `Produção`) e atalho de ação rápida para lançamento.
- **`components/StateControls.tsx`**: Barra interativa presente em todas as telas permitindo alternar e inspecionar os estados:
  - **Normal (Pronto)**
  - **Carregamento (Loading)**
  - **Vazio (Empty)**
  - **Erro (Error)**
  - **Sucesso (Success)**
- **`components/MovementModal.tsx`**: Modal interativo da Tela 6 (Lançar Movimentação Física), com seletor segmentado (`Entrada / Reposição (+)`, `Saída / Baixa (-)`, `Ajuste Balanço (=)`), recálculo ao vivo da disponibilidade pela fórmula `max(0, Físico - Reservado - Margem)` somente em memória, sem registro persistente no livro-razão.
- **`screens/StockScreen.tsx`**: Tela 5 (Estoque e Saldos Centrais).
- **`screens/OrdersScreen.tsx`**: Tela 2 (Pedidos e Reservas de Estoque).
- **`screens/SyncScreen.tsx`**: Tela 3 (Sincronização e Alertas).
- **`screens/AuditScreen.tsx`**: Tela 4 (Histórico e Auditoria de Movimentações).
- **`screens/AnalyticsScreen.tsx`**: Tela 1 (Painel Analítico de Vendas).
- **`screens/MovementScreen.tsx`**: Tela 6 (Lançar Movimentação de Estoque como tela dedicada completa).

---

## 3. Preservação de Autenticação e Configurações de Ambiente

- **Escopo da integração:** somente protótipo visual, sem publicar SPEC-007. O wrapper Access e o backend de autenticação permanecem no checkout original, ainda sem publicação. Esta entrega não autentica usuários nem executa operações reais.
- **Docker e Ambientes:** As variáveis `VITE_DEVELOPMENT_MODE` (`local`, `hybrid`, `preview`, `production`) continuam lidas normalmente e refletidas no badge da topbar.
- **Diagnóstico Técnico:** A tela de diagnóstico da base (saúde de API NestJS, PostgreSQL e Redis) permanece disponível como módulo acessível pelo menu da sidebar ("Diagnóstico do Sistema").

---

## 4. Regras de Negócio Identificadas como Propostas

Em conformidade com a diretriz do usuário e o PRD:
- **Demanda Descoberta e Priorização de Canais (RF-10):** Tratamento de pedidos com estoque insuficiente e a ordem de atendimento constam com aviso explícito de proposta pendente de validação operacional.
- **Resolução Automática de Divergências (RF-12 / RF-15):** Políticas de sobrescrita ou pausa de canais mantêm aviso de proposta para garantir que o saldo remoto não substitua o físico próprio.
- **Margens de Segurança (RF-04 / RF-15):** Valores padrão de reserva e resguardo por variante estão marcados como propostas sujeitas a homologação.
- **Métricas Oficiais de Tráfego e Audiência (RF-19 / RF-20):** O painel analítico explicita que métricas não fornecidas pelas APIs oficiais dos vendedores nunca são presumidas ou exibidas como zero, figurando com indicação de cobertura e escopo.
