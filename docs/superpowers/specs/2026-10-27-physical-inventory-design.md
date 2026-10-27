# Desenho — estoque físico e destinações por canal

**Data:** 27/10/2026. **Estado:** aprovado e implementado somente em Docker local em 27/10/2026. Evidências operacionais em [estoque físico local](../../operations/physical-inventory.md).

## Intenção

Dar ao piloto um estoque físico persistido e auditável por SKU, com lançamentos de abertura, entrada, saída, ajuste e transferência. A equipe precisa ver a reserva física e as quantidades destinadas à Shopee e ao Mercado Livre. O proprietário/administrador define o mínimo de cada SKU. O modo de operação pode ser compartilhado entre os canais ou separado por canal.

## Resultado esperado

- Cada SKU ativo tem saldo físico consultável e histórico persistido.
- Transferências entre reserva física e buckets de canal conservam unidades; cada venda/saída reduz o bucket de origem uma vez.
- O modo compartilhado expõe um bucket comum para os dois marketplaces. Uma venda em qualquer canal consome esse saldo comum, reduzindo a disponibilidade para ambos quando a integração real existir. Regra confirmada pelo usuário em 27/10/2026.
- O modo separado mantém buckets independentes Shopee/Mercado Livre; o administrador transfere quantidades da reserva para cada canal.
- Saldo mínimo é configurado por SKU. Para os saldos sintéticos iniciais, valor padrão é `ceil(quantidade_inicial × 20%)`, em unidades inteiras. Esse é um valor inicial editável, não uma porcentagem dinâmica que muda a cada movimento. O alerta compara o mínimo ao total do SKU em todos os buckets, sem duplicar unidades; regra confirmada pelo usuário em 27/10/2026.
- Admin e Usuário podem registrar movimentos. Somente Admin altera mínimo e modo. Ambos podem consultar saldo/histórico.
- A carga local de teste cria uma única abertura identificada, em SKU ativo, sem seed automático no startup e sem sobrescrever produtos, variantes ou movimentos existentes.

## Escopo e limites

Primeira entrega somente em Docker local, no schema `business`, com a API NestJS e Prisma já habilitados. Inclui endpoints autenticados, interface de estoque, lançamento e histórico, configuração local de modo/mínimos e abertura sintética para os SKUs ativos existentes. Antes da migration e da carga, criar backup criptografado validado e confirmar o banco Docker efetivo.

Não inclui sincronização, OAuth, webhooks, pedidos externos, importação de saldo de marketplace, publicação em Vercel, migration no Neon, Preview/Production ou uso de credenciais reais. O modo compartilhado é comportamento interno testável; ele não atualiza de verdade as plataformas nesta entrega.

## Alternativas consideradas

1. **Colunas de saldo atualizadas diretamente:** menor implementação, mas cada alteração sobrescreve a origem do saldo e torna o histórico/auditoria difícil de confiar. Descartada porque entradas, saídas e transferências precisam ser rastreáveis.
2. **Saldo físico único com números de canal derivados:** mantém pouco dado, mas não permite estoque independente nem transferências para buckets de cada canal. Descartada porque o usuário quer destinação separada e modo configurável.
3. **Ledger de movimentos com buckets e transferências explícitas (escolhida):** cada mudança é imutável e autorizada pelo backend; transferência debita e credita buckets na mesma transação. Permite modo compartilhado ou separado sem duplicar unidades e mantém histórico verificável.

## Modelo proposto

- `StockMovement`: evento imutável vinculado a `CatalogVariant`, ator autenticado para chamadas da aplicação (exceção controlada: `system:local-seed` na carga explícita local), tipo, quantidade inteira positiva, origem/destino quando aplicável, motivo opcional, chave de idempotência e data. Tipos iniciais: abertura, entrada, saída, ajuste e transferência. Não apagar nem editar eventos; correções usam novo ajuste compensatório.
- Buckets: `PHYSICAL_RESERVE`, `SHARED_CHANNEL`, `SHOPEE` e `MERCADO_LIVRE`. Abertura/entrada começa em `PHYSICAL_RESERVE`; transferência muda unidades de bucket sem alterar o total; saída externa diminui o total. `SHARED_CHANNEL` só pode ser usado no modo compartilhado; buckets de canal independentes só no modo separado.
- Saldo por bucket e total são derivados dos movimentos (ou de projeção transacional reconstruível, se a consulta agregada exigir); jamais aceitar saldo informado pelo navegador. Totais não contam unidades destinadas mais de uma vez. Nenhum bucket fica negativo.
- `InventorySettings`: configuração única do piloto, começando em modo `SEPARATE`; somente Admin pode alternar para `SHARED`. A troca é bloqueada enquanto houver saldo nos buckets incompatíveis; Admin deve transferi-los de volta à reserva física antes de trocar. Não há conversão automática nem redistribuição silenciosa. Regra confirmada pelo usuário em 27/10/2026.
- `VariantStockPolicy`: um mínimo por variante/SKU, inteiro não negativo e editável por Admin. O alerta compara o mínimo ao total físico do SKU somando buckets (unidades próprias, sem duplicação). O valor inicial de cada SKU ativo é a quantidade inicial vezes 20%, arredondada para cima.
- Admin/User têm permissão de leitura e de lançar movimentos; somente Admin configura modo e mínimo. Nenhum papel novo é criado. O servidor valida sessão, origem e permissão em cada chamada.

## Carga local de teste

Consultar a lista atual de SKUs efetivamente ativos antes de gerar os valores. Ordenar por SKU e atribuir à reserva física quantidades `25 + 7 × índice baseado em zero`, marcadas com motivo `saldo inicial sintético para homologação`. Atribuir mínimo pela fórmula aprovada. A carga é a exceção de ator `system:local-seed`. Criar uma única operação de seed explícita que recusa alvo fora do Docker local e recusa uma segunda execução para a mesma população; nunca executar no startup. Não atribuir unidades aos canais automaticamente.

## Interface

Preservar a ordem já solicitada: Estoque físico, Movimentações, Histórico de movimentações, Catálogo. Estoque mostra SKU, total próprio, reserva física, destinação comum ou buckets Shopee/Mercado Livre, mínimo e alerta. Movimentações registra abertura, entrada, saída, ajuste e transferência num modal acessível, validado no servidor. Histórico lista eventos reais sem dados simulados. Configurações mostra e altera o modo/minimos apenas para Admin.

## Segurança, consistência e falhas

- Escrita no NestJS; React nunca recebe conexão Prisma ou segredo.
- Quantidades positivas e inteiras; tipos/pares de bucket coerentes com o modo; motivo obrigatório em ajuste e saída; nenhuma subtração pode deixar origem negativa.
- A movimentação e projeção do saldo (se houver) confirmam/rollback numa transação PostgreSQL única. Idempotência evita duplicar uma abertura/transferência em retry.
- Concorrência no mesmo SKU serializada ou protegida por atualização condicional/transação; conflito retorna resposta recuperável, sem saldo perdido.
- SKU inativo não recebe movimento novo, exceto leitura de histórico; produto/variante não é apagado fisicamente.
- Backup/restore business inclui modelos/ledger; migrations explícitas, checadas e locais. Não habilitar para Neon/Preview/Production.

## Questões deixadas ao implementador

- Usar tabela append-only com consulta agregada inicialmente; adicionar projeção/cache somente se necessário, com reconstrução verificável do ledger.
- Movimentos físicos aceitam motivo curto; ajuste e saída exigem justificativa, transferência pode exigir observação opcional.
- Paginação de histórico e chamadas de resumo devem obedecer aos limites de tamanho e rate aplicados no catálogo.
- Quantidades sintéticas variadas serão escolhidas após inventário do catálogo presente no banco local, sem nomes/SKUs escritos na migration.

## Critérios de aceite

1. Todos os SKUs ativos existentes aparecem com saldo de abertura variado na reserva física e mínimo inicial arredondado para cima em 20%; rerun não duplica.
2. Interface distingue reserva, buckets de marketplace, total e mínimo; não apresenta sucesso antes de persistência.
3. Entrada/saída/ajuste/transferência persistem em ledger e o saldo sobrevive a reload/reinício da API.
4. Transferência conserva total; saída/transferência concorrente não produzem saldo negativo ou unidades duplicadas.
5. No modo compartilhado, um bucket comum atende ambos os canais; no separado, Shopee e Mercado Livre têm saldos independentes. Alternar modo com quantidades incompatíveis é recusado sem mudança parcial.
6. Admin/User podem lançar e ler; apenas Admin altera mínimo/modo; sessões inválidas, usuário bloqueado ou origem inválida são recusados.
7. Migrations/restore preservam auth/catalog existentes e só tocam `business`; backup local validado precede migration e carga.
8. Nenhuma chamada marketplace/webhook é feita; Preview, Neon e Production permanecem inalterados.

## Implementação e evidências locais

- Prisma mantém ledger de movimentos e política por variante no schema `business`; migration `20261027125036_inventory`, aplicada explicitamente depois de backup pré-migration restaurado em quarentena.
- API expõe leitura de saldo/histórico/configuração e movimentos autenticados; autorização, validação, idempotência e serialização são cobertas por testes de integração.
- React apresenta Estoque físico, Movimentações, Histórico e Configurações. A busca vazia é válida; telas não apresentam saldos fictícios e o estado inicial configura separação por canal.
- Seis SKUs ativos receberam abertura sintética local, ordenada por SKU, com quantidades 25, 32, 39, 46, 53 e 60 e mínimos 5, 7, 8, 10, 11 e 12.
- Verificação em imagem Docker: lint, typecheck, testes regulares e build aprovados; inventário 8/8 em PostgreSQL 17 e 8/8 em PostgreSQL 18; contrato visual Playwright e smoke autenticado da UI local aprovados.
- O modo compartilhado é apenas uma regra interna de ledger testada; canais não estão configurados nem conectados. Nada foi migrado ou publicado em Neon, Vercel Preview ou Production.
