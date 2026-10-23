# Preview protegido sem domínio próprio

## O que está preparado

**Atualização de 23/10/2026:** o usuário autorizou merge e montagem do Preview. PR #1 integrado em development; projeto Vercel fasemarketplace já existente vinculado e deploy Preview verificado. A configuração da ponte foi ativada apenas no Preview da branch development, com chave do tipo Secret. Requisições anônimas à raiz/API foram redirecionadas para autenticação Vercel (302), túnel recusou chamadas sem chave (401), e chamada autorizada à Function retornou ready para Neon/Redis. As seções de preparação abaixo descrevem também como repetir e desativar o fluxo.

Endereço de acesso: [Preview de development](https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app). Entrar com sua conta Vercel autorizada. A main e o deploy produtivo existente não foram promovidos.

A Vercel fornece o endereço do frontend `*.vercel.app`. Para alcançar o Docker, existe uma ponte preparada no código:

```text
Browser → Vercel /api/health/ready (Function)
        → HTTPS temporário → gateway autenticado → API Docker → Neon
```

Somente o diagnóstico está disponível nesta ponte. Ainda não há autenticação de usuários, cadastro/estoque, WebSocket remoto ou proxy genérico de rotas. A preparação local não publica o sistema. O Preview precisa de proteção de acesso na Vercel, além da chave entre servidores.

O Cloudflare Quick Tunnel é uma opção manual para testes: não exige conta nem domínio próprio e fornece hostname temporário `*.trycloudflare.com`. A URL muda ao reiniciar; não é endereço estável de produção. Não foi instalado/iniciado nesta entrega. Sua adoção e abertura do acesso continuam manuais.

## Campos novos no .env

| Campo | Onde é usado | O que preencher |
|---|---|---|
| `PREVIEW_BRIDGE_KEY` | Gateway local + Function Vercel Preview | Chave privada aleatória; já gerada localmente se o campo estava vazio. Nunca usar prefixo VITE_ |
| `PREVIEW_BRIDGE_PORT` | Docker local | `4374`; somente loopback |
| `PREVIEW_BRIDGE_ORIGIN` | Function Vercel Preview | Origem HTTPS obtida do túnel, sem barra final, caminho ou query; vazio enquanto não houver túnel |
| `PREVIEW_BRIDGE_ENABLED` | Function Vercel Preview | `false` até verificar proteção; `true` somente na ativação manual |

Nenhuma conexão de banco é necessária na Function. A mesma chave privada deve ser copiada diretamente do `.env` para a configuração Preview da Vercel, sem passar pelo chat. O `.env` continua ignorado pelo Git. Não imprimir `docker compose config` ou `docker inspect` completos: eles contêm variáveis privadas.

## 1. Verificar a ponte local

```powershell
docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml -f compose.preview.yaml up -d --build --wait --wait-timeout 180
pwsh -NoProfile -File scripts/verify-preview-bridge.ps1
```

Isso inicia somente um gateway local adicional em 4374, não um túnel. O script confirma recusa sem chave e diagnóstico com chave, sem exibi-la. Interface híbrida segue em 4273; API original segue em 4274. O gateway não recebe credenciais Neon/Redis e não encaminha a chave à API interna. O healthcheck TCP não consulta Neon.

O `.env` e as configurações Compose são duas coisas distintas: o gateway local não depende de `PREVIEW_BRIDGE_ENABLED=true`; essa chave de ativação é verificada na Function da Vercel.

## 2. Preparar Vercel manualmente

Após publicar/revisar o código em uma branch de desenvolvimento, importar o repositório na Vercel:

- Root Directory: raiz do repositório.
- Framework: Vite.
- Install: `npm ci`.
- Build: `npm run build --workspace @fasemarketplace/web`.
- Output: `apps/web/dist`.
- `api/health/ready.mjs` é a Function; o limite configurado é 20 segundos.
- Em Settings > Environment Variables, usar apenas o escopo **Preview** para os campos da ponte.

Começar com `PREVIEW_BRIDGE_ENABLED=false`. O diagnóstico fica indisponível até a ativação completa. Não adicionar conexão Neon nem chave da ponte em campos VITE_. Deixar **`VITE_API_BASE_URL` ausente ou vazio**: o frontend chamará `/api` na própria Vercel. Essa é a configuração preferida desta entrega, substituindo a instrução anterior de chamar a origem externa diretamente do navegador.

Configurar `VITE_TELEMETRY_MODE=off`, `VITE_TELEMETRY_ENVIRONMENT=preview` e `VITE_APP_RELEASE=development` inicialmente.

Em **Settings > Deployment Protection**, habilitar/verificar proteção dos deploys Preview. Em sessão anônima, conferir que tanto `/` quanto `/api/health/ready` exigem autenticação da plataforma em cada URL/alias usado. Um diagnóstico `503` público não demonstra proteção de acesso. Não ativar a ponte enquanto isso não estiver confirmado.

O projeto ainda precisa cumprir as condições do plano Vercel escolhido. Hobby tem restrição a uso pessoal não comercial; não assumir gratuidade para uso comercial nem contratar upgrade automaticamente.

## 3. Se optar pelo túnel temporário

O túnel desta ativação roda no Docker, sem instalação no Windows. Para iniciar/reiniciar explicitamente o serviço gerenciado:

```powershell
docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml -f compose.preview.yaml --profile tunnel up -d preview-tunnel
```

Consultar a URL nos logs **somente do túnel**, atualizar `PREVIEW_BRIDGE_ORIGIN` no `.env` local e na Vercel (Preview, branch development), verificar 401 sem chave e fazer novo deploy Preview. O perfil padrão sem `--profile tunnel` não abre um túnel novo. Imagem cloudflared fixada por digest; nenhum segredo é enviado ao container do túnel. Não usar `down --volumes`.

A alternativa abaixo é para execução manual fora do Docker; não executar as duas simultaneamente sem necessidade.

Instalar `cloudflared` no Windows seguindo o download oficial. Não é necessário comprar domínio ou abrir portas do roteador. Com o gateway local já verificado, iniciar manualmente:

```powershell
cloudflared tunnel --url http://127.0.0.1:4374
```

Usar **4374**, não 4274/4273: o túnel precisa apontar para o gateway autenticado, nunca para a API ou Vite diretamente. O terminal informa uma URL HTTPS temporária. Manter terminal, Docker e máquina ativos.

Verificar na URL temporária `/health/ready`, sem chave, que a resposta é `401`. Conferir que a URL foi obtida do processo iniciado nessa máquina. Não copiar uma URL de terceiro. O gateway continua recusando qualquer chamada sem chave antes de consultar o banco.

No Preview da Vercel, preencher:

```dotenv
PREVIEW_BRIDGE_ORIGIN=https://HOST-INFORMADO.trycloudflare.com
PREVIEW_BRIDGE_KEY=mesmo-valor-privado-do-env-local
PREVIEW_BRIDGE_ENABLED=true
```

Não criar `VERCEL_ENV` manualmente para contornar a restrição: a Vercel fornece `preview` no deploy apropriado. A Function recusa Production e também falha fechada se qualquer configuração estiver ausente/incorreta.

Fazer novo deploy **Preview** e validar: visitante não autenticado bloqueado, usuário autorizado vê a tela e diagnóstico disponível, navegador chama somente `/api` da Vercel e não recebe a chave nem cookies/headers do gateway. Verificar também que apagar/invalidar a chave bloqueia o diagnóstico e que desligar o túnel resulta em indisponível, sem dados internos.

Na primeira ativação, empacotamento da Function, TLS externo, bloqueio anônimo e prontidão autorizada foram verificados. Ao mudar URL, chave, aliases ou configuração de proteção, repetir as verificações; um deploy Ready sozinho não comprova acesso funcional/protegido.

## Parada e rotação

Para parar o túnel gerenciado no Docker:

```powershell
docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml -f compose.preview.yaml --profile tunnel stop preview-tunnel
```

Na alternativa de terminal, parar com Ctrl+C. Na Vercel, mudar `PREVIEW_BRIDGE_ENABLED=false` e fazer novo deploy se quiser desativar a ponte. A função nunca deve ser usada em Produção nesta fase. Para parar só o gateway:

```powershell
docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml -f compose.preview.yaml stop preview-gateway
```

Quando uma URL temporária mudar, atualizar a origem e invalidar a anterior. Se a chave for exposta ou houver dúvida sobre o destino, gerar uma nova chave aleatória de 32 bytes base64url, atualizar o gateway e a Vercel, recriar o gateway e redeployar o Preview. Não copiar arquivos `.env` para GitHub, navegador ou logs.

## Evidência local desta entrega

Lint, typecheck dos workspaces, 50 testes e build passaram em imagem Docker de verificação antes do merge. Gateway real rejeitou chamada sem chave (401) e retornou prontidão API/Neon/Redis com chave (200). Smokes híbrido e totalmente local passaram; revisão independente sem achados importantes. A ativação externa posterior foi autorizada pelo usuário, integrada via PR #1 e verificada conforme atualização no início deste guia. Testes de integração não criaram dados de negócio.

## Referências

- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Node.js Functions e .mjs na Vercel](https://vercel.com/docs/functions/runtimes/node-js)
- [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
