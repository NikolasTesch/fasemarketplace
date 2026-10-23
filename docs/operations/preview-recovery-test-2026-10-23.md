# Ensaio de interrupção e recuperação do Preview — 23/10/2026

## Escopo

Usuário confirmou que seu teste manual do Preview funcionou e autorizou o próximo teste: interromper somente o túnel temporário, verificar o comportamento e recuperar o acesso. Nenhuma migration ou escrita de negócio; sem promoção de main ou alteração do ambiente produtivo.

## Resultado observado

| Etapa | Evidência |
|---|---|
| Antes da interrupção | Function autenticada retornou HTTP 200 e ready para PostgreSQL/Redis, modo mock |
| Túnel parado | Navegador continuou renderizando a tela e apresentou indisponível; API retornou HTTP 503 com apenas status unavailable |
| Atualização durante falha | Botão de diagnóstico funcionou, mantendo indisponível; nenhum erro React |
| Reinício | Somente preview-tunnel reiniciado; URL temporária mudou; novo endereço recusou chamada sem chave com HTTP 401 |
| Reconfiguração | PREVIEW_BRIDGE_ORIGIN atualizado no .env ignorado e somente no Preview Vercel da branch development; novo deploy Preview |
| Após recuperação | Navegador no alias de development mostrou ready; HTTP 200, Neon/Redis disponíveis e atualização manual funcionando |
| Proteção preservada | Raiz e /api/health/ready, sem autenticação Vercel, continuaram redirecionando para login com HTTP 302 |
| Serviços preservados | IDs dos containers API, worker e Redis permaneceram iguais durante o teste |

Código do deploy testado: `0a0927316bc8ff5b8f9a7b93f9da01434711ad76` (development). Deploy recuperado: `dpl_2xMnvF3Vuko6EwfeqYbegkriHmgu`, target Preview. Main permaneceu em `2665745ff465a83f2f33b18d9ddb1a1a933007c9`.

## Conclusão e operação

Ensaio aprovado para o caminho HTTP do Preview e a recuperação do túnel. Como o Quick Tunnel muda de URL, apenas reiniciar o container não recupera o Preview: é necessário atualizar a origem e redeployar. O alias de acesso do usuário permanece igual.

Procedimento: [Preview protegido](protected-preview.md). Este ensaio não testa restauração de banco, processamento de jobs ou funcionalidades de estoque. Cookies temporários de automação foram usados fora do repositório e removidos após o teste; nenhum segredo foi incluído neste registro.
