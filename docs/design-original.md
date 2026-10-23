# design.md — Fase Orçamentos

**Produto:** Sistema interno de orçamentos — Fase Sport  
**Versão:** 0.1  
**Direção visual:** esportiva, profissional, rápida e operacional

---

## 1. Objetivo do design

A interface deve transformar um processo hoje baseado em Excel em uma experiência visual clara, rápida e segura. O sistema não deve parecer uma planilha disfarçada: ele deve guiar o vendedor por uma sequência simples, deixando cálculos, preços, histórico e formatação do documento sob responsabilidade do sistema.

A marca da Fase Sport deve estar presente sem comprometer legibilidade. A identidade visual deve partir do conjunto **vermelho + preto + branco** presente na logo, usando vermelho como cor de ação e destaque, preto para tipografia/estrutura e superfícies claras para a maior parte da interface.

---

## 2. Princípios de UX

### 2.1 Rapidez operacional

O caminho entre abrir “Novo orçamento” e chegar ao PDF deve exigir o mínimo de cliques possível.

### 2.2 Clareza acima de densidade

Evitar telas que reproduzam o excesso visual de uma planilha. Informações relacionadas devem estar agrupadas em blocos bem separados.

### 2.3 Cálculo sempre visível

Subtotal, desconto, total e entrada devem atualizar em tempo real e permanecer visíveis durante a montagem.

### 2.4 Aprendizado embutido na interface

Novos vendedores devem entender o fluxo pela própria tela. Usar labels explícitas, exemplos, estados vazios e ajuda contextual curta.

### 2.5 Consistência entre tela e PDF

A prévia deve representar fielmente o documento final, reduzindo insegurança antes do envio ao cliente.

---

## 3. Identidade visual

A logo fornecida usa linguagem esportiva com predominância de vermelho, preto e branco.

### Paleta inicial sugerida

> Os valores abaixo são tokens iniciais derivados visualmente da marca. Se a Fase Sport possuir manual de marca oficial, ele deve prevalecer.

| Token | Cor | Uso |
|---|---|---|
| `brand-primary` | `#E11D24` | CTAs, destaque, seleção |
| `brand-primary-hover` | `#C9151B` | Hover/pressed |
| `brand-black` | `#0A0A0B` | Navegação, títulos fortes |
| `text-primary` | `#171719` | Texto principal |
| `text-secondary` | `#66666B` | Texto secundário |
| `surface` | `#FFFFFF` | Cards e áreas de conteúdo |
| `surface-muted` | `#F6F6F7` | Fundo da aplicação |
| `border` | `#E2E2E5` | Divisórias e inputs |
| `success` | `#18864B` | Finalizado/sucesso |
| `warning` | `#A76100` | Atenção/expiração |
| `danger` | `#C62828` | Erro |
| `info` | `#2563EB` | Informações neutras |

### Regra de uso do vermelho

O vermelho deve ser usado principalmente para:

- botão primário;
- item selecionado;
- indicadores importantes;
- total final;
- detalhes da identidade da marca.

Evitar grandes áreas vermelhas atrás de formulários longos.

---

## 4. Tipografia

### Interface

**Inter** como fonte principal.

Motivos:

- excelente legibilidade;
- números claros;
- funciona bem em tabelas e formulários;
- ampla disponibilidade;
- aparência neutra o suficiente para equilibrar a logo esportiva.

### Escala

- Display: 32/40, semibold
- H1: 28/36, semibold
- H2: 22/30, semibold
- H3: 18/26, semibold
- Body: 14/22 ou 16/24
- Label: 13/18, medium
- Caption: 12/16
- Valores financeiros: usar `font-variant-numeric: tabular-nums`

---

## 5. Grid e espaçamento

Usar escala de 4px.

Tokens:

- 4px
- 8px
- 12px
- 16px
- 20px
- 24px
- 32px
- 40px
- 48px

Raio padrão:

- inputs: 8px
- cards: 12px
- modais: 16px

### Controles operacionais aprovados — SPEC-0065

O padrão foi aprovado após prévia visual em 2026-09-29 e aplicado em
`src/app/controls.css`. Botões, links de ação, campos e seletores compartilham
raio de **8 px**. Ações principais usam o vermelho operacional `#C9151B`, com
hover `#A51117`; secundárias usam superfície branca, borda cinza e texto escuro;
destrutivas usam vermelho escuro com superfície e borda vermelhas suaves.
Seleção ativa usa fundo `#FFF1F1`, texto e borda da marca.

Tamanho e layout continuam contextuais: regular em formulários, compacto em
tabelas e quadrado em ações com ícone. Checkboxes preservam a forma nativa,
usam o destaque da marca e não herdam padding de campos de texto. Links de
navegação, linhas de combobox e cartões de seleção preservam sua função.
Os estilos locais devem definir layout e dimensões, usando os tokens
`--control-*` para aparência e estados. Revisão visual autenticada das páginas
internas continua sendo condição para aceite completo da spec.

Sombras devem ser discretas. Preferir borda + contraste de superfície.

---

## 6. App shell

### Desktop

- sidebar esquerda: 232–248px;
- topbar: 64px;
- conteúdo com largura fluida;
- background geral `surface-muted`;
- cards em branco.

### Sidebar

Itens conforme role:

**Todos**

- Início
- Novo orçamento
- Orçamentos
- Clientes

**Supervisor/Dono**

- Equipe
- Presets
- Tabela de preços

**Dono/Supervisor**

- Relatórios

**Dono**

- Usuários e permissões
- Configurações

---

## 7. Tela principal — Novo orçamento

Esta é a tela mais importante do produto.

### Estrutura desktop

Dividir em duas áreas principais:

- **Esquerda: 34–38%** — catálogo de peças/presets;
- **Direita: 62–66%** — orçamento em construção.

### Wireframe conceitual

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Topbar                    FAS-2026-000123          Salvar rascunho        │
├───────────────┬───────────────────────────────────────────────────────────┤
│               │ Cliente                                                   │
│  CATÁLOGO     │ [ Nome ] [ WhatsApp ] [ Empresa/Time ]                   │
│               ├───────────────────────────────────────────────────────────┤
│ [ Buscar... ] │ Itens do orçamento                                        │
│               │                                                           │
│ Categorias    │  Camisa Dry Fit       20 x R$ 68,00      R$ 1.360,00    │
│ ● Camisas     │  Short Dry Fit        20 x R$ 40,00      R$   800,00    │
│ ○ Shorts      │                                                           │
│ ○ Kits        │ [+ Adicionar item manual]                                 │
│               ├───────────────────────────────────────────────────────────┤
│ [Preset Card] │ Imagens / observações                                     │
│ [Preset Card] │                                                           │
│ [Preset Card] │                                                           │
│               ├───────────────────────────────────────────────────────────┤
│               │ Subtotal                               R$ 2.160,00       │
│               │ Desconto                               R$     0,00       │
│               │ TOTAL                                  R$ 2.160,00       │
│               │ [ Visualizar ] [ Finalizar orçamento ]                    │
└───────────────┴───────────────────────────────────────────────────────────┘
```

---

## 8. Catálogo de presets

### Header

- busca;
- filtro de categoria;
- ordenação opcional.

### PresetCard

Conteúdo:

- imagem 16:10 ou 4:3;
- nome do produto;
- descrição curta;
- preço fixo de referência da tabela, quando existir; caso contrário, marcador `Preço sob cálculo`;
- badge de categoria;
- botão `Adicionar`.

Ao adicionar, mostrar feedback discreto: “Camisa Dry Fit adicionada”.

### Interação recomendada

Um clique em **Adicionar** aplica o preset ao orçamento. O preset pode inserir um item específico ou um orçamento-base completo, inclusive kits. A composição dos primeiros exemplos reais segue em P-19.

Para produto sob cálculo, o card não deve sugerir um preço final. Depois de incluí-lo, a linha do item oferece **Adicionar personalização** e mantém visíveis a descrição efetiva e o preço resultante. Os valores e faixas usados estão em [pricing-reference.md](pricing-reference.md).

Para quantidade de 1–9 peças, o fluxo permite também **Confecção**. A equivalência da faixa de 10–24 para estampa continua restrita a **Ordem de serviço / Pronta entrega**; Confecção usa as faixas de preço cadastradas, sem fallback implícito.

Não abrir modal para toda inclusão. Modal apenas para visualizar detalhes completos.

Centralizar na viewport todo modal de confirmação, edição ou seleção aberto por uma ação. Manter popovers contextuais, como o seletor de ícones, junto ao controle que os abriu.

---

## 9. Itens do orçamento

Cada linha deve permitir edição sem abrir outra página.

Estrutura:

- thumbnail opcional;
- nome;
- descrição resumida;
- quantidade;
- valor unitário;
- subtotal;
- menu de ações.

### Ações

- editar descrição;
- trocar valor, se permitido;
- duplicar item;
- remover;
- anexar imagem;
- adicionar observação.
- adicionar personalização.

Para item personalizado originado de preset, permitir editar descrição e preço efetivos sem perder o vínculo com a origem. O resumo financeiro automático usa o preço resultante quando fatores e regras estiverem definidos. Com cálculo ou produto incompleto, permitir salvar com aviso visível e impedir finalização.

### Adicionar personalização

Na linha do produto selecionado (ex.: camisa gola redonda PV), abrir um formulário contextual com:

1. técnica: pintura, estampa ou DTF;
2. localização da aplicação;
3. tamanho da aplicação;
4. quantidade do item exibida como `Aplicado às X peças`, sem campo de quantidade separado;
5. quantidade de cores **somente para pintura**.

O apoio contextual ao preço deve mostrar quais fatores são usados: DTF e estampa local usam tamanho e quantidade; pintura usa também cores. Localização aparece na descrição da aplicação, sem indicação de efeito no preço enquanto não houver outra regra aprovada.

Permitir repetir **Adicionar personalização** no mesmo item e listar cada aplicação separadamente (ex.: pintura pequena no peito, duas cores; DTF grande nas costas). Todas mostram a mesma quantidade do item. Ao alterá-la, atualizar a indicação e recalcular as aplicações. Mostrar cada adicional, somá-los ao preço base por peça e arredondar somente o preço unitário completo, sem esconder preço de referência nem descrição comercial. Se ainda faltar regra de preço ou entrada obrigatória, sinalizar `Cálculo pendente`, permitir salvar e impedir finalização, sem exibir total final enganoso. Formato da descrição depende de P-20.

### Quantidade

Usar input numérico compacto com botões `−` e `+` quando fizer sentido.

---

## 10. Item manual

Abrir em um drawer lateral ou modal médio.

Campos:

- nome do item;
- descrição;
- quantidade;
- valor unitário;
- imagem;
- observação.

CTA: **Adicionar ao orçamento**.

Evitar mandar o vendedor para outra página.

---

## 11. Dados do cliente

No topo do builder, usar componente de busca/criação híbrido.

Fluxo:

1. usuário começa digitando nome/telefone;
2. sistema sugere clientes existentes;
3. se não existir, mostrar **Criar novo cliente**;
4. campos adicionais aparecem sem tirar o usuário do orçamento.

Campos visíveis inicialmente:

- nome;
- WhatsApp/telefone;
- empresa/time.

Campos adicionais podem ficar em “Mais dados”.

---

## 12. Resumo financeiro

O resumo deve ser sticky no desktop, sempre visível próximo ao final da área direita.

Exibir:

- subtotal;
- desconto em dois campos editáveis: valor (R$) e percentual (%), com equivalência automática;
- total final;
- entrada `%`;
- valor da entrada;
- saldo.

O **Total final** deve ser o elemento financeiro de maior hierarquia visual.

O desconto começa em zero. Dois campos lado a lado, **Desconto (R$)** e **Desconto (%)**, substituem o seletor de tipo: editar um atualiza a equivalência no outro sobre o subtotal antes do desconto. A última unidade editada é mantida ao alterar os itens (SPEC-0099). Em R$, manter o valor fixo e pedir justificativa quando superar o equivalente a 5% do subtotal. A equivalência é informativa, sem alterar o arredondamento comercial da SPEC-0069/D-49: preço unitário completo, desconto aplicado e total final usam uma casa decimal. Valores monetários são exibidos com duas casas (SPEC-0098); entrada e saldo preservam seus centavos efetivos.

Na tela de orçamento, seletores de modalidade do catálogo e do item e de material usam o mesmo `SearchableChoice` de clientes, produtos e personalizações (SPEC-0100). Digitar pesquisa as opções; aplicar uma modalidade ou material exige escolher uma opção. Escape ou saída do campo preservam a seleção anterior. Listas permanecem junto ao campo, com suporte a teclado e toque.

---

## 13. Condições comerciais

Agrupar em um card chamado **Condições**.

Campos:

- entrada;
- prazo de entrega;
- validade;
- condição de pagamento;
- observações.

Valores padrão aprovados devem vir preenchidos:

- entrada: 50%;
- prazo: 30 dias;
- validade: 7 dias.

O usuário pode alterar essas condições quando necessário. Os dados cadastrais da empresa, separadamente, só podem ser editados por Dono ou Supervisor.

---

## 14. Upload de imagens

Componente de upload em card com drag-and-drop.

Cada imagem deve exibir:

- miniatura;
- nome;
- ação remover;
- checkbox `Exibir no PDF`;
- ação `Definir como principal`.

Mostrar tamanho máximo aceito e formatos permitidos.

---

## 15. Estados do orçamento

Usar badges consistentes:

- Em andamento — azul;
- Vencido — âmbar;
- Finalizado — verde.

`Vencido` sinaliza orçamento não finalizado após o prazo de validade, sem desabilitar edição ou finalização. `Finalizado` permanece mesmo depois do vencimento da validade.

Cor nunca deve ser o único indicador; sempre mostrar texto. A logo oficial foi vetorizada e está disponível como [SVG de produção](assets/fase-sport-logo.svg) (com o [PNG original](assets/fase-sport-logo-reference.png) preservado para referência histórica).

---

## 16. Histórico de orçamentos

Formato principal: tabela/lista com boa leitura.

Colunas recomendadas:

- número;
- cliente;
- responsável;
- data;
- valor;
- status;
- próximo contato;
- ações.

### Filtros

- busca livre;
- período;
- status;
- vendedor;
- origem (Vendedor/Auxiliar);
- faixa de valor.

### Ações rápidas

- abrir;
- visualizar PDF;
- duplicar;
- alterar status;
- WhatsApp;
- agendar follow-up.

---

## 17. Orçamentos do Auxiliar

Orçamentos do Auxiliar devem ter um marcador visual como:

`Criado pelo Auxiliar`

Para Vendedores, mostrar uma área ou filtro:

**Orçamentos disponíveis da equipe**

Todos os orçamentos devem estar visíveis a usuários autenticados, com o nome do vendedor responsável. O filtro pode destacar os registros sem responsável; não deve ocultar os demais orçamentos.

Ação recomendada:

**Assumir orçamento**

Após assumir:

- vendedor passa a ser o responsável;
- vendedor responsável pode editar esse orçamento;
- Auxiliar criador continua podendo editar o orçamento;
- criador original continua registrado;
- sistema registra a alteração no histórico.

Dono, Supervisor e Vendedor responsável atual podem trocar ou desfazer a atribuição, com registro no histórico. Após a troca, a edição por Vendedor usa a responsabilidade atual; o Auxiliar criador mantém sua permissão.

---

## 18. Tela de detalhe do orçamento

Header:

- número;
- status;
- cliente;
- responsável;
- data.

Ações principais:

- Editar;
- Gerar PDF;
- Duplicar;
- Alterar status.

Tabs possíveis:

- Resumo;
- Histórico;
- Follow-up.

Exibir no canto inferior um resumo das **duas últimas alterações**. Ao editar orçamento finalizado, atualizar o orçamento atual, mantendo `Finalizado` e a validade existente até alteração explícita. A consulta da auditoria completa é separada desse resumo.

---

## 19. Preview em tela cheia

A visualização ampliada deve mostrar o orçamento como documento, centralizado em um canvas neutro.

Layout:

- fundo cinza claro;
- documento branco de largura A4 e altura contínua conforme o conteúdo (SPEC-0082, decisão de 2026-10-19);
- zoom;
- botão gerar PDF;
- botão editar;

No desktop, painel lateral opcional com ações.

---

## 20. Design do PDF

O orçamento atual já possui elementos importantes que devem ser preservados conceitualmente, mas reorganizados de forma mais limpa:

O PDF gerado na finalização ou em cada exportação é uma cópia congelada dos dados persistidos naquele instante. Editar o orçamento depois não altera essa cópia. A logo oficial está disponível como [SVG de produção](assets/fase-sport-logo.svg) (com o [PNG original](assets/fase-sport-logo-reference.png) preservado para referência).

- identidade Fase Sport;
- identificação do cliente;
- tabela de itens;
- valores;
- imagem/material;
- condições de pagamento;
- prazo;
- validade;
- dados da empresa.

### Estrutura A4 recomendada

Para a prévia e a imagem compartilhada, a SPEC-0082 mantém essa sequência em um documento contínuo, com rodapé único. Descrições, condições e responsável têm texto ampliado e caixas compactas. O PDF baixado mantém A4 para impressão, com paginação quando necessária; não reduzir as fontes para forçar uma folha única.

```text
┌──────────────────────────────────────────────┐
│ LOGO FASE SPORT              ORÇAMENTO       │
│ dados da empresa             Nº / data       │
├──────────────────────────────────────────────┤
│ CLIENTE                                      │
│ Nome | WhatsApp | Empresa/Time               │
├──────────────────────────────────────────────┤
│ ITENS                                        │
│ Qtd | Descrição      | Unit. | Total         │
│ 20  | Camisa Dry Fit | 68,00 | 1.360,00      │
│ 20  | Short Dry Fit  | 40,00 |   800,00      │
├──────────────────────────────────────────────┤
│                         Subtotal  2.160,00    │
│                         Desconto      0,00    │
│                         TOTAL     2.160,00    │
├──────────────────────────────────────────────┤
│ IMAGEM / REFERÊNCIA DO MATERIAL              │
├──────────────────────────────────────────────┤
│ CONDIÇÕES                                    │
│ Entrada 50% | Prazo 30 dias | Validade 7d    │
├──────────────────────────────────────────────┤
│ Vendedor | contato | observações             │
└──────────────────────────────────────────────┘
```

### Direção visual do PDF

- header branco;
- logo à esquerda;
- filete vermelho;
- título “ORÇAMENTO” forte;
- tabela com cabeçalho preto ou vermelho escuro;
- totais destacados;
- evitar banners grandes dentro do documento;
- priorizar leitura e impressão;
- imagens de material entram em seção específica, sem competir com valores.

---

## 21. Tabela de preços

Tela administrativa com comportamento de grade, mas não visual de Excel puro.

Header:

- título;
- busca;
- categoria;
- `Novo item`;
- `Histórico de alterações`.

Tabela:

- produto;
- categoria;
- descrição;
- preço fixo vigente ou indicação de preço sob cálculo;
- status;
- atualizado por;
- atualizado em;
- ações.

Edição de preço deve pedir confirmação e registrar histórico.

Uma área administrativa para **preços de personalização** deve permitir a Dono e Supervisor consultar e editar tamanhos, faixas de quantidade, preços por peça, adicionais por cor e constantes das fórmulas de [pricing-reference.md](pricing-reference.md). Mostrar a regra vigente, quem a alterou e quando; exigir confirmação para mudanças. A área não pode limitar a edição a valores de produtos de preço fixo e deve tornar explícita a equivalência de 1–9 peças à faixa 10–24 somente para Ordem de serviço/Pronta entrega.

---

## 22. Gestão de presets

Preferir visão em cards + opção de tabela.

Cada preset mostra:

- imagem;
- nome;
- categoria;
- preço fixo de referência da tabela, quando existir, ou marcador `Preço sob cálculo`;
- status;
- última atualização.

Ações:

- editar;
- duplicar;
- desativar;
- visualizar histórico.

---

## 23. Dashboard do Vendedor

Primeira dobra:

- **Novo orçamento** como CTA principal;
- total orçado no mês;
- finalizados;
- em andamento;
- follow-ups hoje.

Abaixo:

- recentes;
- em andamento;
- orçamentos de Auxiliar disponíveis.

Evitar excesso de gráficos.

---

## 24. Dashboard do Supervisor

Mais operacional.

Cards:

- orçamentos hoje;
- total do período;
- finalizados;
- em andamento;
- vencidos.

Blocos:

- performance por vendedor;
- orçamentos parados;
- atividades recentes;
- alertas de preço/preset.

---

## 25. Dashboard do Dono

Mais analítico e resumido.

Primeira dobra:

- valor total orçado;
- valor finalizado;
- vencidos;
- comparação com período anterior.

Gráficos recomendados:

- evolução por período;
- funil por status;
- performance por vendedor;
- produtos mais orçados;
- descontos médios.

O Dono pode acessar qualquer orçamento, mas a navegação deve colocá-lo primeiro na visão de negócio.

`Fechado` nos indicadores significa `Finalizado`, sem indicar pagamento recebido. O período e o denominador do ticket médio dependem de P-14.

---

## 26. Componentes principais

### Base

- Button
- IconButton
- Input
- CurrencyInput
- PercentageInput
- Select
- Combobox
- Checkbox
- Radio
- Textarea
- DatePicker
- Badge
- Tooltip
- Modal
- Drawer
- Toast
- Tabs
- Table
- Pagination
- EmptyState
- Skeleton

### Domínio

- `PresetCard`
- `QuoteItemRow`
- `CustomerSelector`
- `QuoteTotals`
- `QuoteStatusBadge`
- `PriceHistoryDrawer`
- `QuotePreview`
- `AttachmentUploader`
- `FollowUpCard`
- `SellerPerformanceCard`

---

## 27. Padrões de feedback

### Salvamento

Mostrar estado discreto no header:

- Salvando…
- Salvo agora
- Erro ao salvar

### Alterações críticas

Usar confirmação para:

- finalizar orçamento;
- arquivar;
- alterar preço;
- desativar preset;
- trocar responsável.

### Erros

Erros devem aparecer perto do campo e também, quando necessário, em toast.

---

## 28. Empty states

Exemplo — nenhum orçamento:

**Você ainda não criou nenhum orçamento.**  
Crie o primeiro orçamento usando presets da Fase Sport ou itens manuais.

CTA: **Criar orçamento**

Exemplo — nenhum resultado de busca:

**Nenhum orçamento encontrado com esses filtros.**

CTA secundário: **Limpar filtros**

---

## 29. Responsividade

### Desktop

Experiência principal.

### Tablet

Catálogo pode reduzir para 300–340px e o builder ocupar o restante.

### Mobile

Em vez de duas colunas simultâneas, usar tabs:

- `Catálogo`
- `Orçamento`

Barra inferior fixa com:

- quantidade de itens;
- total;
- botão `Revisar`.

A geração e envio de orçamento pelo celular devem continuar possíveis, mesmo que a edição complexa seja mais confortável no desktop.

---

## 30. Acessibilidade

- contraste mínimo adequado;
- foco visível;
- inputs sempre com label;
- não depender apenas de cor;
- botões com áreas de clique adequadas;
- navegação por teclado;
- ícones com tooltip/aria-label;
- formatação monetária consistente em `pt-BR`.

---

## 31. Convenções de conteúdo

### Verbos de ação

Usar textos objetivos:

- Criar orçamento
- Adicionar item
- Adicionar item manual
- Salvar rascunho
- Finalizar orçamento
- Gerar PDF
- Duplicar
- Assumir orçamento
- Arquivar

Evitar CTAs genéricos como “Confirmar” quando uma ação específica puder ser nomeada.

---

## 32. Tokens de estado

### Hover

Aumentar contraste ou usar background sutil.

### Focus

Ring de 2px baseado no `brand-primary` com offset claro.

### Disabled

Reduzir contraste, manter legibilidade e nunca remover completamente o label.

---

## 33. Direção de ícones

Usar uma única biblioteca de ícones lineares, por exemplo Lucide.

Peso visual simples e consistente.

Não usar ícones decorativos esportivos na interface operacional. A personalidade da marca deve vir principalmente de cor, tipografia, logo e imagens de produto.

---

## 34. Experiência de treinamento

Para facilitar onboarding de vendedores:

- presets com nomes claros;
- campos com exemplos;
- tooltips em desconto, entrada e validade;
- estados vazios explicativos;
- onboarding curto na primeira utilização;
- opção futura de modo demonstração/treinamento.

O sistema deve ensinar o fluxo enquanto o usuário trabalha.

---

## 35. Prioridade de prototipação

A ordem recomendada para protótipos é:

1. Novo orçamento;
2. Preview/PDF;
3. Histórico de orçamentos;
4. Dashboard do Vendedor;
5. Tabela de preços;
6. Presets;
7. Dashboard do Supervisor;
8. Dashboard do Dono;
9. Cliente/detalhe;
10. Usuários e permissões.

---

## 36. Direção final

A interface deve transmitir:

- velocidade;
- controle;
- confiança;
- profissionalismo;
- simplicidade;
- identidade Fase Sport.

A experiência deve parecer um **sistema comercial moderno da própria Fase Sport**, e não uma planilha web.
Na implementação da [SPEC-0053](specs/SPEC-0053-fluxo-integrado-orcamento.md), o detalhe usa **Resumo** e **Composição** na mesma rota. A composição é editada pelo editor completo já autorizado; a visualização para o cliente continua em **Visualizar documento**. Finalizar fica compacto no topo e também aparece na lista para orçamentos elegíveis. As duas últimas alterações e o responsável ocupam duas colunas no rodapé, empilhadas no celular. O painel de follow-up deixa de aparecer nesse detalhe; seus registros e indicadores existentes não são apagados.

A [SPEC-0066](specs/SPEC-0066-desempenho-e-feedback-orcamentos.md) carrega a composição somente ao abrir esse modo. A interface indica a espera e conserva o rascunho ao alternar as abas depois do carregamento. Links de ação apresentam feedback durante navegação; Novo orçamento e detalhe têm estados de carregamento específicos.


## Improve — fluxo aprovado em 2026-10-13

A [SPEC-0067](specs/SPEC-0067-improve-chamados.md) adiciona Improve ao menu de todos os perfis. A página apresenta Meus chamados (Todos os chamados para o Dono), filtros por tipo/status, paginação de 20 registros e acesso a Novo chamado. O formulário pede tipo, título, descrição e tela afetada opcional; orienta a não incluir senhas ou dados sensíveis, mostra envio pendente e preserva os campos em falhas.

O detalhe apresenta relato original, resposta do desenvolvedor e histórico. Somente Dono vê o formulário de status/resposta; os demais acompanham somente seus próprios relatos. Erros de concorrência orientam recarga sem descartar a resposta digitada. A interface usa controles existentes, rótulos, alertas de erro, feedback de sucesso e layout responsivo. A primeira fatia não inclui anexos, notificações externas, prazos ou edição do relato enviado.
