# Design de interfaces — Fase Sport

> Guia reutilizável para sistemas internos da Fase Sport, extraído do Fase Orçamentos em 22/10/2026. Base de código: `4c2fe6f`, checkout `codex/issue39-catalog-sync`. Este pacote é independente do repositório original.

## 1. Como usar este guia

Ao iniciar outro sistema da empresa, utilize este documento como referência de identidade, estrutura de tela e aparência dos componentes. Adapte os módulos, os nomes, as permissões e os fluxos ao domínio do novo produto.

**Origem dos padrões:** as medidas e cores identificadas como implementadas foram conferidas no CSS e nos componentes do checkout local. Recomendações de padronização estão explicitamente indicadas. Esta extração não inclui inspeção visual autenticada nem comprovação de correspondência com o deploy de Produção.

O `design.md` original do Fase Orçamentos combina propostas iniciais, regras comerciais e evoluções posteriores. Este guia concentra a linguagem visual que pode ser compartilhada entre produtos. Em caso de conflito com o rascunho inicial, os valores operacionais apresentados aqui refletem o código consultado. Um manual oficial de marca fornecido pela empresa deve prevalecer sobre inferências de identidade.

## 2. Identidade e princípios

**Personalidade:** profissional, esportiva, objetiva e operacional. A interface deve transmitir clareza, controle e confiança.

- Fundos muito claros, painéis brancos e texto escuro.
- Vermelho concentrado nas ações principais, na seleção e em destaques relevantes.
- Bordas finas, cantos moderadamente arredondados e sombras discretas.
- Tipografia sem serifa, boa leitura de números e hierarquia clara.
- Formulários organizados em blocos; tabelas densas o suficiente para o trabalho diário.
- Linguagem direta, com o nome da ação e feedback durante operações.
- Personalidade da marca por logo, cor e composição, sem decoração esportiva excessiva.

## 3. Logo e arquivos de marca

![Logo Fase Sport](assets/fase-sport-logo.svg)

Arquivos incluídos:

- `assets/fase-sport-logo.svg`: versão vetorial utilizada pela aplicação; preferencial para interfaces.
- `assets/fase-sport-logo.png`: alternativa raster existente no diretório público da aplicação.

O SVG tem proporção original de **1076 × 323**. Preserve a proporção e não redesenhe o símbolo usando texto ou ícones.

No shell atual, a logo tem aproximadamente **170 px** de largura no desktop e **140 px** na navegação compacta. O componente de imagem reserva dimensões próximas de 174 × 52 px.

**Recomendação de aplicação:** manter a logo sobre uma superfície branca e separar o nome do sistema da marca corporativa. Usar “FASE [NOME DO SISTEMA]” no cabeçalho, com descrição curta opcional. Área de proteção e tamanho mínimo oficial não foram definidos nas fontes consultadas.

## 4. Paleta operacional implementada

| Token atual | Valor | Aplicação |
|---|---|---|
| `--brand` | `#C9151B` | Botão primário, seleção, destaque |
| `--brand-dark` | `#A51117` | Hover primário e texto destrutivo |
| `--background` | `#F6F6F8` | Fundo da aplicação |
| `--surface` | `#FFFFFF` | Painéis, campos e sidebar |
| `--text` | `#171717` | Texto principal |
| `--muted` | `#676767` | Texto secundário e ajuda |
| `--border` | `#E2E2E8` | Contornos e divisórias |
| `--focus` | `#1F5EFF` | Cor-base do contorno de foco |
| `--control-hover` | `#F6F6F8` | Hover de ação secundária |
| `--control-selected` | `#FFF1F1` | Seleção e fundo destrutivo suave |
| `--control-danger-border` | `#E9B4B6` | Borda destrutiva |
| `--control-danger-hover` | `#FDE8E8` | Hover destrutivo |
| `--control-disabled` | `#F1F1F4` | Campos desabilitados |

A navegação ativa utiliza a variação próxima `#FFF0F0`; o hover das linhas de tabela usa `#FAFAFB`. O vermelho `#E11D24` aparece na paleta inicial do documento de origem, mas o token global operacional é `#C9151B`.

### Cores de estado existentes

| Sentido visual | Fundo | Texto | Exemplo no sistema de origem |
|---|---|---|---|
| Informação / em curso | `#EEF4FF` | `#24559A` | Em andamento |
| Atenção | `#FFF1DF` | `#8A4D00` | Vencido |
| Sucesso | `#E9F7EE` | `#176B3A` | Finalizado |

Esses pares estão implementados como classes de estado, não como tokens globais. Para novos produtos, podem ser promovidos a tokens sem mudar seus valores. Preserve o sentido das cores, mas defina os estados de negócio de cada produto separadamente. Sempre acompanhe a cor de texto ou outro indicador compreensível.

O tema extraído é claro. Não foi identificado um sistema de tokens para modo escuro nas fontes globais consultadas.

## 5. Tipografia

Pilha declarada na aplicação:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

**Limite da extração:** o layout raiz consultado não carrega Inter com `next/font`, e o CSS global não declara `@font-face`. Portanto, a fonte efetivamente renderizada pode ser uma alternativa do sistema. Para garantir a mesma tipografia entre produtos, recomenda-se distribuir e carregar explicitamente Inter com pesos compatíveis.

| Elemento | Padrão encontrado |
|---|---|
| Corpo | 14 px; entrelinha 1,5 |
| Título de página interna | `clamp(25px, 2.5vw, 34px)`; entrelinha 1,2; tracking `-0.04em` |
| Título de página até 600 px | 27 px |
| Título de painel | 16 px; tracking `-0.02em` |
| Descrição de página | 13 px; entrelinha 1,6 |
| Label de formulário | 12 px; peso 650 |
| Ajuda de campo | 11 px; peso 400; entrelinha 1,6 |
| Botão | 12 px; peso 750 |
| Link de navegação | 13 px; peso 650 |
| Tabela | 12 px |
| Cabeçalho de tabela | 10 px; caixa alta |
| Identificador acima do título | 10 px; caixa alta; tracking `0.12em` |
| Valor de indicador | `clamp(24px, 2.3vw, 30px)` |

Os pesos 650 e 750 estão declarados no CSS; a fonte carregada determina sua reprodução ou aproximação. Para números alinhados, usar `font-variant-numeric: tabular-nums`. Apresentar valores monetários em `pt-BR`, com duas casas decimais, sem inferir regras de cálculo ou arredondamento comercial a partir da apresentação.

## 6. Espaçamento, bordas e elevação

O documento de origem recomenda escala de **4 px**: 4, 8, 12, 16, 20, 24, 32, 40 e 48 px. O código contém ajustes contextuais como 7, 14, 18, 22 e 36 px; a escala é uma orientação, não uma restrição já aplicada universalmente.

| Elemento | Padrão reutilizável |
|---|---|
| Controles | Raio de 8 px |
| Painéis e cards principais | Raio de 12 px |
| Modais | Raio de 12–16 px, conforme contexto existente |
| Badges | Formato de cápsula |
| Borda comum | 1 px sólida com `--border` |
| Painel comum | Sombra `0 2px 4px #17171903` |
| Lista de combobox | Sombra `0 12px 28px rgba(0,0,0,.14)` |
| Modal administrativo | Sombra `0 24px 80px rgba(15,20,35,.28)` |
| Padding de painel/formulário | Normalmente 24 px |
| Gap de formulário | 16 px |

Priorize separação por superfície, borda e espaçamento. Reserve elevação mais forte para elementos flutuantes.

## 7. Estrutura da aplicação

```text
┌──────────────────────┬──────────────────────────────────────────────┐
│ Logo Fase Sport      │ FASE [SISTEMA]       Atualizações / Conta   │
│                      ├──────────────────────────────────────────────┤
│ Categoria do sistema │ Identificador curto                         │
│                      │ Título da página              Ação principal│
│ Ação principal       │ Descrição                                    │
│ Navegação            │                                              │
│ Item ativo           │ Indicadores, filtros, painéis ou formulário  │
│ Outros módulos       │                                              │
│                      │                                              │
│ Marca / descrição    │                                              │
└──────────────────────┴──────────────────────────────────────────────┘
```

### Desktop implementado

- Sidebar branca: **236 px**, borda direita, sticky e altura `100dvh`.
- Padding da sidebar: `30px 18px 20px`.
- Topbar: **72 px**, sticky, `z-index: 20`, padding horizontal de 36 px, fundo branco translúcido e blur de 12 px.
- Conteúdo: largura `min(1440px, calc(100% - 72px))`, centralizado, padding vertical `36px 0 64px`.
- Cabeçalho da página: título e descrição à esquerda, ações à direita; margem inferior de 28 px.
- Avatar circular de 34 px, fundo vermelho suave, inicial em vermelho.

### Navegação

Itens com raio de 8 px, altura mínima de 44 px e ícone linear de 18 px. O item ativo usa texto vermelho, fundo `#FFF0F0` e uma faixa interna de 3 px na lateral esquerda. A ação de criação recebe fundo vermelho sólido e texto branco.

Os módulos e seus papéis de acesso pertencem ao produto. Manter o mesmo padrão visual não exige copiar os menus de Orçamentos, Clientes ou Catálogo.

## 8. Componentes e estados

### Botões

| Variante | Aparência e uso |
|---|---|
| Primário | Fundo e borda `--brand`, texto branco; hover `--brand-dark` |
| Secundário | Branco, borda cinza e texto escuro; hover `--control-hover` |
| Destrutivo | Fundo `#FFF1F1`, borda `#E9B4B6`, texto `--brand-dark` |
| Compacto | Mesma linguagem visual, altura mínima de 34 px e padding `6px 10px` |
| Somente ícone | Dimensão mínima de 32 × 32 px, padding de 4 px e nome acessível |

Botão regular: `inline-flex`, centralizado, gap de 7 px, altura mínima de 42 px, padding `10px 14px`, borda de 1 px e raio de 8 px. Em dispositivos de ponteiro impreciso, a altura mínima dos controles passa a 44 px; botões de ícone também ganham largura mínima de 44 px.

Transições implementadas: cor, fundo e borda em **150 ms ease**. Botões desabilitados usam cursor de indisponibilidade e opacidade 0,6. Durante submissão, o componente existente desabilita o botão, usa `aria-busy` e troca o texto, por exemplo “Salvar” → “Salvando…”.

### Campos

- Label explícita acima do controle, normalmente com gap de 7 px.
- Fundo branco, borda de 1 px, raio de 8 px, padding `10px 12px`, largura de 100% e `min-width: 0`.
- Textarea com redimensionamento vertical.
- Campos desabilitados com fundo `#F1F1F4`, texto secundário e cursor de indisponibilidade.
- Checkbox e radio nativos de 18 × 18 px, com `accent-color: var(--brand)`.
- Inputs, selects e textareas usam fonte de 16 px quando `pointer: coarse`.

### Seleção com pesquisa

O `SearchableChoice` usa campo com lista ancorada, margem superior de 4 px, raio de 10 px, altura máxima de 280 px e rolagem própria. A opção ativa usa fundo vermelho suave. Há navegação por setas, seleção com Enter e fechamento com Escape. Enter é interceptado para não submeter o formulário indevidamente.

**Recomendação para cada novo fluxo:** definir explicitamente se digitar limpa o valor anterior ou apenas pesquisa; o componente de origem permite configurar esse comportamento. Texto digitado não deve ser confundido com uma seleção válida quando o campo exige uma opção cadastrada.

### Tabelas e listagens

- Cabeçalho muito claro, labels em caixa alta, divisórias horizontais.
- Padding típico: `14px 12px` no cabeçalho e `18px 12px` nas células.
- Hover sutil em `#FAFAFB`.
- Descrição secundária abaixo da identificação principal quando necessário.
- Rolagem horizontal no contêiner da tabela, preservando a largura da página.
- Alinhar valores à direita e usar números tabulares nas colunas financeiras, como nos módulos existentes.
- Ações compactas e agrupadas; status visível como texto dentro de badge.

### Cards de indicadores

Brancos, borda fina, raio de 12 px e padding de 22 px. Uma faixa vermelha de **36 × 3 px** fica na borda superior, a 22 px da esquerda. O título é secundário e o valor tem maior hierarquia. A grade base consultada utiliza três colunas; até 600 px, empilha os cards.

### Modais e popovers

Modais de confirmação, edição e seleção ficam centralizados na viewport. A base dos diálogos nativos abertos é `position: fixed; inset: 0; margin: auto`.

- Superfície branca, borda fina e sombra destacada.
- Largura limitada ao viewport, altura máxima e rolagem interna.
- Exemplos existentes: confirmação até 430 px; edição simples até 480 px; edição administrativa até 920 px.
- Backdrop escuro translúcido; uma variante administrativa usa `rgba(19,25,37,.58)`.
- Cabeçalho com título e botão de fechar; rodapé com ações específicas.

Popovers de busca, seleção contextual e ícones permanecem junto ao campo. Para novos modais, recomenda-se assegurar foco inicial, contenção de foco, Escape e retorno ao gatilho. A extração do CSS não comprova esses comportamentos em todos os componentes.

## 9. Feedback e conteúdo

- Nomear ações: “Criar cliente”, “Salvar alterações”, “Adicionar item”, “Arquivar registro”.
- Exibir espera na própria ação ou região afetada: “Carregando…”, “Salvando…”.
- Confirmar sucesso de forma discreta, próxima da operação.
- Apresentar erro junto ao campo ou em mensagem visível no formulário.
- Usar estado vazio com explicação curta e próximo passo.
- Diferenciar lista sem registros de busca sem resultados; nesta última, oferecer “Limpar filtros”.
- Preservar o conteúdo digitado quando uma operação falhar, conforme o fluxo específico.

**Recomendação para novos sistemas:** usar `role="status"` para feedback informativo e `role="alert"` para falhas que precisam de atenção; definir confirmações com base no impacto da ação no domínio do produto.

## 10. Responsividade implementada

| Faixa | Comportamento do shell |
|---|---|
| Acima de 1150 px | Sidebar de 236 px, topbar de 72 px e margens de conteúdo de 36 px |
| Até 1150 px | Sidebar de 210 px, margens de conteúdo de 20 px; subtítulo da topbar oculto |
| Até 850 px | Uma coluna; sidebar vira região superior; menu horizontal com rolagem; topbar estática de 60 px |
| Até 600 px | Margens de conteúdo de 16 px; título de 27 px; indicadores empilhados; ações e filtros adaptados |

Alguns componentes possuem breakpoints próprios em 560, 640, 700, 760, 768 e 900 px. Não existe um único breakpoint para todos os conteúdos.

**Recomendação para novos produtos:** reutilizar o shell acima e escolher os pontos de quebra dos formulários pela legibilidade. Não transportar automaticamente a proposta inicial de abas móveis do orçamento: o código consultado empilha seu editor até 850 px.

## 11. Ícones, acessibilidade e movimento

Os ícones da navegação são SVGs lineares, com `viewBox="0 0 24 24"`, tamanho de 18 × 18 px, `stroke-width="1.6"`, sem preenchimento e extremidades arredondadas. São definidos no próprio componente; não pressupõem uma dependência instalada de Lucide.

**Recomendação:** usar uma única família linear consistente para novos módulos; ocultar ícones decorativos da árvore de acessibilidade e dar nome acessível às ações sem texto.

O foco implementado usa contorno de **3 px** com `color-mix(in srgb, var(--focus) 40%, transparent)` e offset de 2 px. O shell possui link “Pular para conteúdo”, e o menu indica a página ativa com `aria-current`.

Nos novos sistemas, verificar contraste, zoom, teclado e leitores de tela. O inventário de estilos não equivale a uma certificação de acessibilidade. Respeitar `prefers-reduced-motion`: os controles existentes removem transições, e a regra global desativa a rolagem suave. Novas animações devem seguir essa preferência.

## 12. Login e documentos

O login atual usa fundo `#F7F7F9` e duas colunas: apresentação da marca e cartão branco de autenticação. O cartão tem raio de 16 px, padding de 40 px e sombra discreta; campos têm altura mínima de 46 px. Até 600 px, a composição vira uma coluna e o cartão usa padding de 28 px. A comunicação institucional pode usar título grande com palavras em vermelho, mantendo o formulário sóbrio.

Documentos utilizam o mesmo vocabulário visual, mas têm composição própria. A prévia atual usa papel branco com largura de 210 mm, canvas neutro, cabeçalho escuro com texto branco, tabelas, áreas financeiras destacadas e rodapé escuro. Isso difere da proposta inicial de cabeçalho branco do documento original. Para novos relatórios, recomenda-se preservar logo, hierarquia e legibilidade de impressão; a paginação e o conteúdo dependem do produto.

## 13. Tokens CSS para iniciar outro sistema

O bloco abaixo reúne os tokens globais e de controle conferidos, com nomes preservados. É uma base de aparência, não uma biblioteca completa de componentes.

```css
:root {
  --background: #f6f6f8;
  --surface: #ffffff;
  --text: #171717;
  --muted: #676767;
  --border: #e2e2e8;
  --brand: #c9151b;
  --brand-dark: #a51117;
  --focus: #1f5eff;

  --control-radius: 8px;
  --control-border: var(--border);
  --control-surface: var(--surface);
  --control-hover: #f6f6f8;
  --control-selected: #fff1f1;
  --control-danger: var(--brand-dark);
  --control-danger-border: #e9b4b6;
  --control-danger-hover: #fde8e8;
  --control-disabled: #f1f1f4;
  --control-touch-size: 0px;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--background);
  color: var(--text);
  font: 14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button, input, select, textarea { font: inherit; }

@media (pointer: coarse) {
  :root { --control-touch-size: 44px; }
  input, select, textarea { font-size: 16px; }
}
```

Carregar explicitamente a fonte escolhida, implementar os componentes com seus estados e validar o resultado nos viewports do novo produto.

## 14. Checklist para manter a família visual

- Logo oficial preservada, sem distorção.
- Paleta operacional e vermelho primário consistentes.
- Tipografia carregada de forma previsível.
- Shell, margens, títulos e navegação coerentes.
- Controles de 8 px e painéis de 12 px de raio.
- Estados de hover, foco, seleção, indisponibilidade e espera definidos.
- Feedback claro e campos com labels.
- Modais centralizados; listas contextuais ancoradas.
- Tabelas contidas na página e layout adaptado para telas pequenas.
- Valores numéricos alinhados e formatação coerente.
- Uso por teclado, toque e com movimento reduzido conferido.
- Conteúdo, regras comerciais e permissões definidos pelo domínio do novo sistema.

## 15. Fontes da extração

Caminhos abaixo são referências relativas ao repositório original `fasemento`; não são dependências deste pacote.

| Fonte | O que fundamenta |
|---|---|
| `docs/design.md` | Intenção visual, princípios, conteúdo e diretrizes originais |
| `docs/project-context.md` e `docs/open-decisions.md` | Distinção entre proposta, implementação e aceite |
| `docs/ui-component-inventory.md` | Famílias de controles e limites do inventário |
| `src/app/globals.css` | Tokens, shell, tipografia, cards, tabelas, login, documentos e responsividade |
| `src/app/controls.css` | Controles, variantes, estados, foco e toque |
| `src/app/layout.tsx` e `src/app/(app)/layout.tsx` | Estrutura raiz, idioma, marca e conta |
| `src/components/app-navigation.tsx` | Ícones, navegação e indicação de carregamento |
| `src/components/searchable-choice.tsx` | Busca, seleção e teclado |
| `src/components/pending-submit-button.tsx` | Estado de submissão |
| `src/app/(app)/orcamentos/page.module.css` | Alinhamento contextual de colunas financeiras e ações |
| `public/fase-sport-logo.svg` e `public/fase-sport-logo.png` | Arquivos de marca incluídos |

Este documento registra uma extração da implementação local na data indicada. Recomendações para novos sistemas não alteram nem aprovam retroativamente os fluxos do Fase Orçamentos.
