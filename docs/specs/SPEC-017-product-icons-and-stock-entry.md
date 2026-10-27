# SPEC-017 — Ícones de produto e entrada direta pelo estoque

**Data:** 27/10/2026. **Estado:** implementação preparada em `development`; migration de ícone não aplicada ao banco local durante esta integração.

## Objetivo

Facilitar o cadastro a partir da tela Estoque físico e permitir identificar cada produto por um símbolo esportivo. A entrada manual é o caminho principal; transferências mostram a destinação Shopee/Mercado Livre sem duplicar o total físico.

## Regras

- Administrador vê um botão vermelho destacado “Cadastrar produto” na tela de Estoque físico. O botão abre modal sobre a própria tela.
- O modal reutiliza o cadastro persistente do Catálogo. Cadastro concluído atualiza a lista; falha exibe erro no modal.
- Produto guarda uma chave de ícone Material Symbols de uma lista fechada: camisa, short, bola, garrafa, meia, calça, raquete e outros esportes.
- Lista do catálogo e cartões de saldo exibem o ícone persistido. Ícones inválidos são recusados pelo backend e constraint do banco.
- Migração aditiva adiciona `icon_name`, padrão `sports_soccer`; runtime recebe UPDATE somente nessa coluna adicional. Aplicação da migration exige procedimento de backup/restore do projeto.
- Movimentação inicia em Entrada, lançada em `PHYSICAL_RESERVE`, e a interface explica que essa entrada aumenta o total físico. Ajustes e saídas indicam bucket trabalhado; transferência indica origem e destino entre reserva e canais. Transferência redistribui unidades e conserva o total; entrada, saída e ajuste alteram o total físico.
- O ledger físico continua sem integração automática com marketplace; futuras saídas automáticas permanecem fora desta spec.

## Aceitação

1. Administrador abre o cadastro pelo botão em vermelho na tela de estoque, sem depender do menu Catálogo.
2. Ícone pode ser selecionado visualmente, persiste no produto e aparece no Catálogo e na lista de estoque após recarga.
3. Usuário sem perfil admin não vê o botão; API de catálogo continua sendo a autorização efetiva.
4. Valores arbitrários de ícone são recusados. Produtos existentes recebem o ícone padrão sem perda de dados.
5. Entrada continua alterando a reserva física; os buckets de canal e total permanecem coerentes com o ledger.
6. Migration só é aplicada explicitamente após validação de backup local. Nenhuma gravação remota ou chamada a marketplace ocorre.
