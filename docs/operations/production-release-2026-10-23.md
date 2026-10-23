# Ativação inicial de Production — 23/10/2026

## Autorização e promoção

O usuário autorizou explicitamente publicar no GitHub, validar o Preview e promover para main ativando Production. Foram integrados [PR #3](https://github.com/NikolasTesch/fasemarketplace/pull/3) em development e [PR #4](https://github.com/NikolasTesch/fasemarketplace/pull/4) em main. Este registro documenta a ativação inicial; atualizações documentais posteriores podem ter novos commits/deployments sem alterar o runtime descrito.

| Item | Evidência da ativação |
| --- | --- |
| Commit de implementação | `82099e54392b05670f8c67829f31d73036910444` |
| Commit homologado em development | `d12b1a5b77f783ae9a99aa1979ae1fdd5d9962c5` |
| Preview homologado | `dpl_1cMKhpSVC8iReZ7Rd1EmwzfoZ8La`, Ready, origem/commit conferidos |
| Commit da primeira promoção main | `8dabca82c3ed067e5e11600118252120a20a3f8e` |
| Deployment inicial Production | `dpl_FV5WpYwXaoLA8VDtUMtRDMxzXL3A`, Ready, target production, branch main |
| Frontend produtivo | [fasemarketplace.vercel.app](https://fasemarketplace.vercel.app) |
| Imagem Docker produtiva | `fasemarketplace-production:8dabca82c3ed067e5e11600118252120a20a3f8e` |
| Digest da imagem | `sha256:d8da55843c7ceaea18b0906fdb050ea9acc69f7f140a262e61def73c5e5278b2` |
| Revisão OCI da imagem | `8dabca82c3ed067e5e11600118252120a20a3f8e` |
| Release da configuração | `2026-10-23-spec006` |

O código da imagem foi construído a partir de main limpo após a promoção. Comparação das árvores Git confirmou que o conteúdo promovido era idêntico ao conteúdo dos 55 testes/lint/typecheck/build executados no Docker. Redis/volumes e o túnel produtivo foram preservados na troca de imagem.

## Validação efetiva

- Preview publicado: React, identificação Preview, resposta 200/ready real e botão de atualização passaram no navegador autenticado. Raiz e diagnóstico anônimos continuaram 302 para login Vercel.
- Production publicada: React, identificação Production, GET `/api/health/ready` 200/ready, PostgreSQL e Redis disponíveis e `marketplaceMode=mock`. Botão de atualização funcionou; sem erros de página.
- Restrição da Function publicada: POST retornou 405; query arbitrária retornou 404; resposta de prontidão com `cache-control: no-store` e somente contrato sanitizado.
- O navegador não acessou Neon, túnel ou PostHog diretamente. Respostas observadas do navegador foram conferidas contra a chave e senha privadas sem registrar seus valores; nenhum vazamento encontrado.
- Smoke Docker Production passou após a troca da imagem; revisão independente do diff completo da promoção sem bloqueadores.
- Sete variáveis Preview/development e sete Production separadas. Chaves sensíveis, conexão Neon e Redis fora da Vercel e do bundle; `PRODUCTION_BRIDGE_ENABLED=true`. Development da Vercel não participa do fluxo Docker e fica sem variáveis.

## Limites e continuidade

Apenas a infraestrutura de diagnóstico está ativa. Worker ainda mantém heartbeat; autenticação de produto, filas/jobs, migrations, estoque e integrações comerciais não foram implementados. Nenhuma escrita de negócio foi realizada. O frontend Production é público; isso não autoriza expor dados ou rotas de negócio sem autenticação.

Production depende do computador, Docker, internet e túnel ativos. A URL do túnel pode mudar ao reiniciar e exigir atualização da variável e redeploy. PostHog permanece desligado por falta de projeto confirmado. Backup/restore e uso operacional com dados reais continuam pendentes.

Para operação, usar [guia produtivo](production-docker.md), [matriz de ambientes](environment-configuration.md) e [Preview protegido](protected-preview.md). Os snapshots anteriores da preparação não representam a configuração desligada como estado atual após esta ativação.
