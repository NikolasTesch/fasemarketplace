# Configuração manual — Vercel + Docker + Neon

## Estado e responsabilidade de cada serviço

Decisão de 23/10/2026: React/Vite na Vercel; API e worker na máquina local; PostgreSQL remoto no Neon; Redis no Docker. A criação dos recursos será feita manualmente pelo usuário. Não houve deploy, criação de banco remoto ou abertura de túnel nesta etapa.

A SPA não precisa de Cloud Function agora. Nenhuma credencial PostgreSQL ou Redis deve ser cadastrada com prefixo VITE_. A integração Neon retornou `action restricted: organization is managed by Vercel` ao tentar criar o projeto na organização escolhida `Vercel: nikolasdtesch-4933's projects`; nenhum recurso foi criado. Seguir pelo painel da Vercel.

## 1. Neon: criar e separar os bancos

1. No painel Vercel, selecionar o time **nikolasdtesch-4933's projects**. Abrir **Storage / Marketplace**, procurar **Neon** e iniciar a criação de um banco/projeto.
2. Nome do projeto: **fasemarketplace**. Selecionar plano **Free**, PostgreSQL **17** e região **São Paulo / AWS sa-east-1**, se disponíveis nesse fluxo. Não aceitar upgrade pago; se a região não estiver disponível no plano gratuito, pausar essa escolha.
3. No console Neon, abrir o projeto. A branch raiz pode aparecer como `main` ou `production`; deixá-la como **production**. Não usar sua conexão no Docker de desenvolvimento.
4. Em **Branches**, criar **development** a partir da raiz ainda vazia. Usar somente dados sintéticos. Não copiar dados produtivos futuramente sem decisão explícita.
5. Manter o menor compute permitido no Free e suspensão automática habilitada (5 minutos, se configurável). Não ativar réplicas, endpoints adicionais ou recursos pagos.
6. Selecionar explicitamente **development**, abrir **Connect**, escolher o banco/role exibidos e habilitar **Connection pooling**. Copiar a URI PostgreSQL para o arquivo local `.env`, campo `NEON_DATABASE_URL`.
7. Para o driver desta aplicação, deixar a query da URI como **`?sslmode=verify-full`**. Remover outros parâmetros copiados; não alterar usuário, senha codificada, hostname ou banco. Não usar `sslmode=disable` nem desativar verificação de certificado.
8. Copiar somente o hostname pooled para `NEON_DEVELOPMENT_HOST`, por exemplo `ep-exemplo-pooler.sa-east-1.aws.neon.tech`. Conferir novamente no painel que o endpoint pertence à branch **development**. O nome informado no env é uma declaração local, não uma consulta à API Neon.

Não é necessário enviar a senha no chat. Não preencher uma conexão de produção no `.env` local. A aplicação aceita o banco escolhido no Connect (por exemplo `neondb`); não é obrigatório criar outro banco chamado fasemarketplace.

O frontend da Vercel não usa Neon diretamente. Não habilitar injeção automática da conexão produtiva em todos os Previews. Variáveis privadas eventualmente criadas pela integração não substituem a separação explícita de endpoints.

## 2. Arquivos locais

O `.env` é ignorado pelo Git; `.env.example` contém somente campos vazios e valores fictícios. O Compose lê o `.env` da raiz. Não é necessário duplicá-lo como `.env.local`.

| Campo | Onde obter | Como preencher |
|---|---|---|
| `DATABASE_URL` | Já configurado | Manter PostgreSQL Docker; não substituir por Neon |
| `REDIS_URL` | Já configurado | Manter `redis://redis:6379` |
| `NEON_DATABASE_URL` | Neon > development > Connect > pooling | URI privada com `sslmode=verify-full` |
| `NEON_DEVELOPMENT_HOST` | Host da mesma URI | Somente o hostname pooled development |
| `HYBRID_API_PORT` | Configuração local | `4274`; somente loopback |
| `WEB_ALLOWED_ORIGINS` | URL final do frontend | Origem HTTPS exata, sem barra final; múltiplas separadas por vírgula |
| `VITE_API_BASE_URL` | Futuro acesso HTTPS protegido à API | Preencher no painel Vercel, conforme etapa 4; campo raiz serve como referência |

Manter `APP_ENV=local`, `MARKETPLACE_MODE=mock` e telemetria desligada inicialmente. O modo híbrido injeta `DATABASE_PROVIDER=neon` e `NEON_BRANCH=development`; não editar esses campos para contornar a validação.

## 3. Iniciar e verificar o modo híbrido

Somente após preencher os dois campos Neon:

```powershell
docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml up -d --build --wait --wait-timeout 180
docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml ps
Invoke-RestMethod http://127.0.0.1:4274/health/ready
```

Este é um Compose independente: **não** combinar `-f compose.yaml -f compose.hybrid.yaml`. Ele usa projeto/volume Redis próprios e não remove os volumes do Compose local. Pode coexistir com o ambiente local (portas diferentes); parar os serviços que não estiver usando.

```powershell
docker compose -p fasemarketplace-hybrid -f compose.hybrid.yaml stop
```

Não há reset, migration de negócio ou cópia de dados nesse processo. Para voltar ao fluxo completamente local, usar os comandos habituais de `compose.yaml`.

No híbrido, o healthcheck da API testa liveness sem consultar Neon. O worker consulta dependências na inicialização e a cada 10 minutos, permitindo suspensão do banco entre usos. A saúde Docker não comprova disponibilidade contínua do banco: `/health/ready` é a verificação sob demanda. Recarregar repetidamente a tela ou consultar o banco continuamente consome compute; o plano gratuito possui limites. Esse heartbeat é apenas bootstrap, não uma política para futuros jobs comerciais.

## 4. Vercel: preparar o frontend

O código inclui `vercel.json` para build da SPA, sem Functions. A publicação ainda depende de repositório GitHub, acesso/plano e transporte protegido à API. O plano Hobby da Vercel restringe uso comercial; verificar elegibilidade antes de publicar este projeto, sem contratar plano automaticamente.

Ao importar o repositório no painel Vercel:

- Root Directory: **raiz do repositório**, não `apps/web`.
- Framework: **Vite**.
- Install: `npm ci`.
- Build: `npm run build --workspace @fasemarketplace/web`.
- Output: `apps/web/dist`.
- Production Branch futura: `main`; base de integração atual: `development`. A publicação do código não cria Preview nem Production.

Em **Settings > Environment Variables**, escopo **Preview**, cadastrar:

| Nome | Valor |
|---|---|
| `VITE_API_BASE_URL` | Origem HTTPS protegida da API local, sem barra final e sem `/api` |
| `VITE_TELEMETRY_MODE` | `off` inicialmente |
| `VITE_TELEMETRY_ENVIRONMENT` | `preview` |
| `VITE_APP_RELEASE` | `development` inicialmente |

Sem `VITE_API_BASE_URL`, a SPA tenta `/api` na própria origem, que só possui proxy no Vite local. A URL nunca deve ser `localhost`, IP privado, conexão Neon ou senha. No Vercel, variáveis VITE_ são incorporadas ao build e precisam de novo deploy quando mudam.

Para Produção, não preencher a API de desenvolvimento: backend produtivo, autenticação, conexão/banco, backups e gates ainda não existem. Não habilitar deploy produtivo automático antes de definir esses pontos.

## 5. Acesso remoto à API: pendente

A API híbrida escuta somente em `127.0.0.1:4274`. Para outros computadores acessarem o frontend publicado, será necessário um túnel HTTPS autenticado ou acesso privado equivalente à máquina. Provedor/domínio e autenticação precisam ser definidos antes de abrir o acesso. CORS (`WEB_ALLOWED_ORIGINS`) permite a origem do navegador, mas não impede chamadas diretas e não substitui autenticação.

Não abrir portas do roteador, PostgreSQL ou Redis. Não cadastrar tokens secretos em VITE_. A máquina precisa permanecer ligada e os containers ativos. Não configurar um túnel público irrestrito nesta etapa.

## 6. PostHog

Opcional e separado da hospedagem. Seguir [posthog.md](posthog.md): criar projeto de desenvolvimento, escolher região, preencher token **público de ingestão** e host. Não colar Personal API Key no frontend. O híbrido permanece com telemetria desligada nesta primeira configuração; PostHog do worker exige configuração própria posterior.

Na Vercel, após criar o projeto PostHog de desenvolvimento, preencher `VITE_POSTHOG_PROJECT_TOKEN` com o token público `phc_...` e `VITE_POSTHOG_HOST` com `https://us.i.posthog.com` ou `https://eu.i.posthog.com`, conforme a região escolhida. Então mudar `VITE_TELEMETRY_MODE` para `posthog` e fazer novo build/deploy. Esses valores são públicos por definição; não usar Personal API Key nem Project Secret. No Compose local original, os equivalentes são `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST` e `TELEMETRY_MODE`, conforme guia específico.

Redis não exige cadastro em plataforma: a instância local já está definida. Não criar Redis remoto agora.

## Evidências desta etapa

- Lint, typecheck, 42 testes e build passaram em imagem Docker de verificação.
- Compose híbrido validado com valores sintéticos, projeto `fasemarketplace-hybrid`, Redis/volume separados e API somente loopback.
- Banco Neon real, HTTPS externo, CORS contra origem publicada e deploy Vercel **não foram testados**, pois os recursos ainda serão criados manualmente.

## Referências

- [Vercel: builds](https://vercel.com/docs/builds/configure-a-build)
- [Vite: variáveis públicas](https://vite.dev/guide/env-and-mode)
- [Neon: conexão](https://neon.com/docs/get-started/connect-neon)
- [node-postgres: SSL](https://node-postgres.com/features/ssl)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
