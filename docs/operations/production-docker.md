# Production técnica no computador

## Estado verificado — 23/10/2026

Desenho [SPEC-006](../specs/SPEC-006-production-docker.md) aprovado pelo usuário. Stack `fasemarketplace-production` iniciada e validada: API/worker compilados, Redis exclusivo, gateway autenticado e túnel independente. O banco é a branch Neon `production`, distinta de `development`. Nenhuma funcionalidade ou escrita de negócio foi executada.

A promoção foi autorizada e concluída: [Production na Vercel](https://fasemarketplace.vercel.app) usa a ponte exclusiva e seu diagnóstico foi validado no navegador. O [registro da ativação inicial](production-release-2026-10-23.md) identifica commits, deployment e imagem. As evidências de preparação ao final deste documento são históricas, anteriores à publicação.

## Arquivo privado

`.env.production` já foi preparado neste checkout e está ignorado pelo Git. Não sobrescrevê-lo com o exemplo. Para outro checkout, copiar `.env.production.example` e preencher:

- `PRODUCTION_IMAGE` e `APP_RELEASE`: identificador da imagem/release conferida. A ativação usa imagem do commit `8dabca82c3ed067e5e11600118252120a20a3f8e`, com revisão OCI correspondente, e release `2026-10-23-spec006`. A imagem anterior com sufixo `0a09273-spec006-worktree` serviu apenas à preparação e não é a imagem ativa. Mudanças futuras de runtime devem construir/identificar a imagem a partir do commit aprovado e registrar seu digest.
- `NEON_PRODUCTION_DATABASE_URL`: URI privada da role `fasemarketplace_production_app`, banco `neondb`, host aprovado e query apenas `?sslmode=verify-full`. O exemplo não contém senha. Não colar a URI em mensagens ou variáveis VITE_.
- `NEON_PRODUCTION_HOST`: hostname pooled aprovado na spec, sem protocolo/caminho. A aplicação também o confere contra o endpoint produtivo fixado no código; mudar de endpoint exige uma alteração revisada.
- `PRODUCTION_BRIDGE_KEY`: chave aleatória exclusiva de 32 bytes em base64url. API/worker não recebem esta chave; somente gateway e Function a utilizam.
- `PRODUCTION_BRIDGE_ORIGIN`: origem HTTPS do túnel desta stack; não usar o túnel de Preview.

A role produtiva foi criada via SQL, com login, sem superuser, criação de roles/bancos, replicação, bypass RLS ou associação a `neon_superuser`. O diagnóstico exige somente conexão/`SELECT 1`. Permissões de tabelas serão definidas nas specs de persistência, sem usar a role administrativa no runtime. A [documentação Neon de roles](https://neon.com/docs/manage/roles) explica a diferença entre criação por SQL e pela API/console.

## Iniciar e verificar

Na raiz do repositório, usar PowerShell 7 (`pwsh`):

```powershell
docker compose --env-file .env.production -p fasemarketplace-production -f compose.production.yaml up -d --build --wait --wait-timeout 180
pwsh -NoProfile -File scripts/verify-production.ps1
docker compose --env-file .env.production -p fasemarketplace-production -f compose.production.yaml ps
```

O comando usa um Compose independente. Nunca mesclar com `compose.yaml`, `compose.hybrid.yaml` ou `compose.preview.yaml`. Sempre especificar `--env-file` e `-p`: o projeto local não pode escolher o nome desta stack por herança.

API: `http://127.0.0.1:4474/health/live`; gateway: `http://127.0.0.1:4475/health/ready`, que recusa acesso sem chave. Redis não tem porta no host. O worker mantém somente heartbeat; BullMQ/jobs, migrations e autenticação de usuários ainda não existem.

## Túnel e Vercel

```powershell
docker compose --env-file .env.production -p fasemarketplace-production -f compose.production.yaml --profile tunnel up -d --no-build production-tunnel
```

Consultar a URL HTTPS anunciada no log **apenas** de `production-tunnel` e atualizar `PRODUCTION_BRIDGE_ORIGIN` no arquivo privado e no escopo **Production** da Vercel. Não imprimir `docker compose config` ou `docker inspect` completos: eles podem incluir segredos. A [matriz](environment-configuration.md) lista as variáveis e seus destinos.

O túnel serve apenas ao gateway autenticado. Sem chave, retorna 401; a chave de Preview também deve retornar 401. A chave não vai para o navegador. A Function serve exclusivamente GET `/api/health/ready` e sanitiza o resultado.

Na ativação após revisão/publicação autorizada:

1. Homologar a mudança no Preview de development, preservando banco e chave de Preview.
2. Conferir commit, imagem Docker correspondente, configuração efetiva e acesso da Vercel. Na auditoria desta entrega o frontend Production retornou 200 anônimo; Preview retornou 302 para login. Isso não é autenticação de produto. Não disponibilizar dados/rotas de negócio sob essa configuração.
3. No escopo Production, conferir origem/chave exclusivas; atualizar `VITE_APP_RELEASE` para a release aprovada e `PRODUCTION_BRIDGE_ENABLED=true` antes do novo deployment autorizado.
4. Promover somente o código revisado para `main`, conforme workflow aprovado. Verificar `/api/health/ready` no endereço produtivo, `mock`, dependências disponíveis e ausência de vazamento de informações. Registrar deployment e commit efetivos.
5. Ensaiar falha/reinício do túnel produtivo, corrigindo apenas sua origem. Não usar a ponte de Preview como fallback.

Variáveis só serão utilizadas em um deployment novo. Enquanto `PRODUCTION_BRIDGE_ENABLED=false`, o diagnóstico produtivo permanece indisponível por projeto. Não copiar `PREVIEW_BRIDGE_*`, conexões Neon ou Redis para o escopo Production da Vercel.

## Parar e preservar dados

```powershell
docker compose --env-file .env.production -p fasemarketplace-production -f compose.production.yaml --profile tunnel stop
```

Não usar `down -v`, reset, seed ou limpeza de volumes. Para reverter a publicação, usar a imagem/deployment anterior e desativar a ponte se necessário, preservando banco/Redis. Não há migrações nesta entrega; uma futura migração exige procedimento próprio de backup, ensaio e recuperação.

## Evidências históricas da preparação e limites

- Lint, typecheck, 55 testes e build passaram no target Docker `verify`. Testes novos recusam endpoint/role/TLS incorretos e fallback entre pontes. O teste de worker depende de Linux; no host Windows ocorreu timeout, e na execução reproduzível Docker ele passou.
- Smoke produtivo passou com todos os serviços saudáveis. Gateway recusou ausência de chave, chave inválida e chave de Preview; túnel autenticado retornou `ready`. Gateway de Preview recusou chave produtiva.
- Inspeção confirmou redes e volumes Redis distintos. API produtiva sem bind mounts; imagem sem `.env`, `.env.production`, `.env.local` e pastas de fontes da aplicação. Imagem compilada validada: `sha256:17c5cdfbf52cab6bf5ea20035a96282f2e5547b2c22e9b2b635189a80629eb74`.
- Smokes local, híbrido e gateway de Preview continuaram passando. Revisão independente de código/configuração sem achados críticos/importantes.
- Function executada a partir do código local com a configuração Production alcançou o túnel real: 200/ready; ao parar somente o túnel, 503/unavailable sanitizado; após reiniciar e atualizar a origem exclusiva, 200/ready. Isso valida o handler e transporte; não é evidência de deployment na Vercel. A role produtiva foi confirmada ausente da branch development.
- Sete variáveis Production cadastradas e metadados conferidos, chave sensível e ponte false. Sete variáveis Preview/development preservadas; diagnóstico do Preview publicado continuou ready. Sem variáveis Development da Vercel, pois esse escopo não participa do fluxo Docker.
- Sem conta/projeto PostHog confirmado: coleta permanece `off`.
- Máquina, Docker, internet e túnel precisam estar ativos. URL temporária muda ao reiniciar. Serviços gratuitos continuam sujeitos às cotas; nenhuma hospedagem paga foi contratada.
- Recuperação de dados, autenticação, filas de negócio e primeira operação real continuam pendentes. Esta entrega prepara infraestrutura; não homologa a operação comercial.
