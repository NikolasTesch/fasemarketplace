# Design — chamados de bugs e melhorias

**Data:** 27/10/2026
**Estado:** aprovada pelo usuário em 27/10/2026; implementação local em andamento, com migrations 002/003 aplicadas no PostgreSQL local.

## Intenção

Adicionar ao FaseMarketplace a área **Bugs e melhorias**, acessível pela barra lateral, para registrar problemas e sugestões diretamente no sistema e permitir que os usuários consultem os chamados já registrados. Isso centraliza o relato com contexto da tela e uma imagem opcional.

## Escopo

- Nova entrada na navegação e página com lista compartilhada de chamados, ordenada dos mais recentes para os mais antigos.
- Ação **Novo chamado** abre modal com tipo (erro ou melhoria), tela afetada, título, descrição e uma imagem opcional.
- Submissão persiste os dados no PostgreSQL e identifica o usuário autenticado que abriu o chamado. Novo chamado inicia no estado **Aberto**.
- Qualquer usuário autenticado pode consultar todos os chamados e abrir novos. Nesta etapa ninguém pode editar, comentar ou fechar; o controle de acesso para essas ações será especificado depois.
- Imagem única opcional, armazenada no PostgreSQL nesta entrega, limitada a PNG/JPEG/WebP e 5 MiB.
- O serviço de chamados usa uma interface de armazenamento de imagens; a implementação ativa nesta entrega é PostgreSQL. Um adaptador Cloudflare R2 poderá ser adicionado depois sem acoplar rotas e regras de chamados ao provedor.
- Implementação e validação restritas ao ambiente Docker local com autenticação já habilitada. Não expor endpoints na Vercel/Preview/Production, não migrar banco remoto nem publicar código como parte desta entrega.

## Fora do escopo

Comentários, edição, fechamento, atribuição, notificações, filtros avançados, implementação/configuração do bucket Cloudflare R2, credenciais, storage remoto, ativação remota e qualquer mudança na autenticação/perfis atuais.

## Alternativas consideradas

- **A — PostgreSQL para chamados e imagem com porta substituível (recomendada e escolhida):** reaproveita a base existente, evita novo serviço e entrega persistência compartilhada; uma interface interna limita o acoplamento para R2 posterior. As imagens aumentam backup e armazenamento do banco nesta entrega, mitigados por limite de tamanho.
- **B — PostgreSQL para metadados e serviço separado para imagens:** separa arquivos do banco e escala melhor anexos, mas requer escolher/provisionar serviço não aprovado no projeto.
- **C — interface sem persistência:** menor esforço, mas não atende ao pedido de chamados fixados no sistema.

**Decisão do usuário:** abordagem A. Em 27/10/2026, o usuário confirmou manter PostgreSQL como implementação ativa e preparar uma interface para futura integração com Cloudflare R2. Bucket, credenciais, upload remoto e migração dos anexos PostgreSQL existentes permanecem fora desta etapa.

## Restrições e desenho proposto

- Reutilizar a tela e os padrões visuais do shell React/Vite e os componentes existentes de formulário, lista, modal e feedback.
- Criar API NestJS e tabela/migration próprias para chamados; não misturar entidades de domínio com tabelas `auth_*`.
- A API depende de uma interface `TicketImageStorage`; o adaptador PostgreSQL é a única implementação ativa nesta etapa. A tabela de chamados guarda provedor/chave/MIME, enquanto os bytes ficam em tabela local de anexos. A futura adoção de R2 exige adaptador e estratégia de leitura/backfill dos anexos PostgreSQL existentes.
- Proteger leitura e criação com sessão autenticada e senha provisória já trocada, usando o guard de acesso existente. O backend aplica autorização; esconder controles na interface não é controle de segurança.
- Guardar o identificador do autor e apresentar nome/data na lista sem expor e-mail ou dados da sessão.
- Validar no backend tipo, tela, tamanho/formato de campos e arquivo. Limitar tamanho do anexo e corpo HTTP sem enfraquecer o limite global existente de 8 KiB para operações de acesso.
- A listagem deve ser paginada, mostrar tipo, título, tela, autor, data, estado e indicar quando há imagem; abrir detalhes/anexo sem permitir alteração. Detalhes da paginação e apresentação visual são escolhas de implementação consistentes com componentes existentes.
- Campos obrigatórios: tipo, tela afetada, título e descrição. A imagem é opcional. As telas serão opções alinhadas às seções já existentes na navegação; a lista exata deve refletir a interface vigente ao implementar.

## Critérios de aceite

1. Usuário autenticado comum ou administrador abre chamado com os campos obrigatórios e anexo opcional; após sucesso o registro está persistido.
2. Qualquer usuário autenticado pode consultar chamados de todos os autores, inclusive após recarregar a página e reiniciar os serviços locais.
3. Chamados aparecem inicialmente como **Aberto**, com autor e data; anexo válido pode ser visualizado e anexo inválido/excessivo é recusado com mensagem clara.
4. Usuário sem sessão ou com troca obrigatória pendente não pode consultar nem criar chamados por chamadas diretas à API.
5. Nenhuma ação de editar, comentar ou fechar é oferecida nesta fatia; nenhum endpoint correspondente é exposto.
6. Migration é explícita e aplicada somente no PostgreSQL Docker local. Preview, Production, dados remotos e configurações externas ficam intocados.
7. Lint, typecheck, build, verificações funcionais locais e revisão do diff seguem o workflow do projeto; não há commit, push, publicação ou merge automático.

## Pontos para aprovação

A proposta assume que a tela de chamados exige autenticação, que todos os usuários autenticados podem criar e ler, que a imagem é opcional e única, e que registros começam como **Aberto**. O limite e a lista de formatos de imagem serão fixados no plano/implementação dentro de limites seguros.
