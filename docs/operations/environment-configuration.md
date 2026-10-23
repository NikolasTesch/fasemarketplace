# Configuração dos ambientes

**Estado de 23/10/2026:** local e Preview existentes; Production Docker aprovada e validada na [SPEC-006](../specs/SPEC-006-production-docker.md). Backend produtivo ativo; ponte Vercel Production preparada/desligada até promoção explícita do código. [Evidências e comandos](production-docker.md).

## Quais ambientes existem

| Uso | Configuração | Banco e Redis | Situação |
| --- | --- | --- | --- |
| Docker local | `.env` + `compose.yaml` | PostgreSQL/Redis locais | Existente |
| Desenvolvimento híbrido | `.env` + `compose.hybrid.yaml`, projeto `fasemarketplace-hybrid` | Neon development + Redis híbrido | Existente |
| Vercel Preview de Git `development` | Settings → Environment Variables → Preview, branch `development` | Function encaminha diagnóstico ao Docker híbrido | Configurado e validado na entrega anterior |
| Vercel Development | Escopo usado por ferramentas locais como `vercel dev` | Não deve acessar Production | Sem variáveis; não é necessário ao fluxo Docker atual |
| Vercel Production de Git `main` | Settings → Environment Variables → Production | Ponte exclusiva ao Docker Production preparada | Bootstrap anterior publicado; variáveis cadastradas, ponte desligada |
| Docker Production | `.env.production` + `compose.production.yaml`, projeto `fasemarketplace-production` | Neon production + Redis exclusivo | Ativo e validado; túnel autenticado próprio |

`development` é uma branch Git e também o nome escolhido para uma branch Neon. O ambiente **Development da Vercel é outra configuração**: não é o Preview publicado da branch Git. Não precisamos preenchê-lo com segredos para o Docker funcionar.

## Onde cadastrar cada variável

| Variável | Preview / branch Git development | Production | Localização |
| --- | --- | --- | --- |
| `VITE_DEVELOPMENT_MODE` | `preview` | `production` | Vercel; pública, entra no bundle |
| `VITE_APP_RELEASE` | `development` | `pending-main-release`; trocar pela release na promoção | Vercel; pública |
| `VITE_TELEMETRY_MODE` | `off` | `off` | Vercel; pública |
| `VITE_TELEMETRY_ENVIRONMENT` | `preview` | `production` | Vercel; pública |
| `VITE_API_BASE_URL` | Ausente/vazia: usa `/api` | Ausente/vazia: usa `/api` | Vercel; pública |
| `PREVIEW_BRIDGE_ENABLED` | `true` | Ausente | Function Preview |
| `PREVIEW_BRIDGE_ORIGIN` | URL atual do túnel híbrido | Ausente | Function Preview |
| `PREVIEW_BRIDGE_KEY` | Segredo exclusivo existente | Ausente | Function Preview + gateway híbrido |
| `PRODUCTION_BRIDGE_ENABLED` | Ausente | Inicialmente `false`; `true` após validação | Function Production, após implementação |
| `PRODUCTION_BRIDGE_ORIGIN` | Ausente | URL do túnel produtivo exclusivo | Function Production, após implementação |
| `PRODUCTION_BRIDGE_KEY` | Ausente | Novo segredo exclusivo | Function Production + gateway produtivo, após implementação |
| Conexão PostgreSQL/Neon | Não cadastrar na Vercel | Não cadastrar na Vercel | API/worker Docker do ambiente correspondente |
| Conexão Redis | Não cadastrar na Vercel | Não cadastrar na Vercel | API/worker Docker do ambiente correspondente |

Preview/development mantém suas sete variáveis (quatro `VITE_` e três `PREVIEW_BRIDGE_`). Production recebeu outras sete (quatro `VITE_` e três `PRODUCTION_BRIDGE_`), com chave exclusiva sensível e ativação `false`. Configurar variáveis não altera o deployment anterior; falta publicar o código revisado e ativar a ponte na promoção aprovada.

## Arquivos env, passo a passo

1. `.env.example` é um modelo versionado sem segredos. `.env` é a cópia privada que já configura os modos local e híbrido; não substituir suas conexões preenchidas ao reorganizar o modelo.
2. `.env.production.example` é o modelo separado da SPEC-006. Sua cópia privada `.env.production` contém a configuração da stack produtiva. O Compose deve receber esse arquivo explicitamente, para não herdar a configuração de development por engano. O arquivo privado já foi preenchido neste checkout; não sobrescrevê-lo.
3. `.env.local` pode ter sido criado pela CLI da Vercel e contém configuração privada da ferramenta. Não copiar seu conteúdo para Docker, Git ou mensagens.
4. As variáveis cadastradas no painel da Vercel são independentes desses arquivos. Selecionar o escopo e, em Preview, a branch Git exata; salvar uma variável não modifica deployments anteriores. Uma nova implantação deve usar a configuração revisada.
5. Tudo com prefixo `VITE_` pode ser visto pelo visitante. Nunca usar esse prefixo para senha, connection string Neon, URL Redis ou chave privada da ponte.

## PostHog e disponibilidade

PostHog fica `off` enquanto não houver projeto confirmado. A instrumentação já existe; ativar depois exige separar development/Production e conferir a região. Não é dependência para o ambiente iniciar.

Docker Production no computador evita contratar outro servidor nesta etapa, mas continua sujeito às cotas dos serviços remotos e à disponibilidade da máquina. Reiniciar o túnel pode mudar seu endereço; não cadastrar uma URL temporária como domínio definitivo da API. O endereço `vercel.app` continua funcionando como frontend enquanto o diagnóstico pode ficar indisponível se o backend parar.
