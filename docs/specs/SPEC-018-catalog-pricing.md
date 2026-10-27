# SPEC-018 — Preço de venda e custo no catálogo

**Data:** 27/10/2026. **Estado:** aprovado em outro chat e incluído no branch `development`; migration aditiva não aplicada ao banco da demonstração nesta integração.

## Regras

- Nome, descrição, preço de venda e custo são obrigatórios no cadastro/edição administrativa do produto. Valores são em BRL, não negativos, com até duas casas decimais e limite compatível com `DECIMAL(12,2)`.
- Backend valida os valores como texto decimal e grava `DECIMAL(12,2)`, sem cálculo monetário em ponto flutuante.
- Produtos já existentes recebem `NULL` na migration para não inventar preço/custo. A tela mostra os campos vazios e exige preenchimento do Admin ao editar; mudança de status preserva os valores ainda não preenchidos.
- Runtime ganha apenas UPDATE nas colunas `sale_price` e `cost`. A migration é aditiva, versionada e executada somente após backup local criptografado e restore isolado válido.
- Preços não são enviados a marketplaces e não implicam promoção, margem, fiscal, pedidos ou comissão nesta fatia.

## Aceitação

1. Produto novo não é salvo sem nome, descrição, preço e custo válidos.
2. Validação rejeita negativos, texto, mais de duas casas, mais de dez dígitos inteiros e atribuição em colunas não autorizadas.
3. Valores aparecem em BRL no formulário e preservam centavos após consulta/reabertura.
4. Produtos existentes sem valor não recebem zero fictício; o Admin consegue preencher preço/custo durante a edição.
5. Migration só é aplicada após fluxo de recuperação local aprovado; nenhum ambiente remoto é alterado.
