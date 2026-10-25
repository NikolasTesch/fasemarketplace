# SPEC-008 — Autenticação no Preview protegido

**Estado:** contrato técnico fechado para implementação e ensaio local após a solicitação de execução do usuário em 24/10/2026. Login local integrado já validado (E01.1). Ativação remota, migration Neon e publicação continuam pendentes de autorização própria. Ver [plano de execução](../superpowers/plans/2026-10-24-preview-access-transport.md).

## Objetivo e limites

Homologar o login da SPEC-007 pela Vercel Preview e API Docker, usando Neon development e Redis híbrido, sem modificar Production. Preservar cadastro fechado, perfis técnicos admin/user, troca obrigatória, bloqueio e revogação.

Não redesenhar o protótipo visual, contratar infraestrutura, criar convites por e-mail, escolher ORM ou implementar catálogo/estoque nesta entrega. Migration Neon e publicação têm autorização operacional própria, posterior ao desenho aprovado.

## Alternativas de transporte para decisão

| Alternativa | Benefícios | Custos/limites |
| --- | --- | --- |
| A — Navegador chama `/api/access/*` na Vercel; Function encaminha ao gateway Docker | Mantém a mesma origem do frontend e esconde URL/chave da ponte do navegador; aproveita a topologia existente | Exige implementar transporte de cookies, corpo, origem e identidade de rede com allowlist; depende do túnel/computador |
| B — Navegador chama API HTTPS diretamente | Menos um salto de aplicação na Vercel | Exige origem HTTPS apropriada, CORS com credenciais e solução para cookies entre sites; o túnel vira parte do endereço usado pelo navegador |

**Recomendação para discussão:** alternativa A, no alias estável do Preview de development. A documentação descreve cookies entre sites como uma possível causa de falhas no Safari e apresenta proxy na origem do frontend como solução. Isso fundamenta a recomendação, mas não comprova o funcionamento da nossa ponte. [Better Auth — cookies e proxy](https://www.better-auth.com/docs/concepts/cookies).

**Decisão técnica desta execução:** alternativa A, preservando a topologia Vercel/gateway/Docker já adotada. A implementação será validada localmente com ativação remota desligada, sem contratar infraestrutura ou expor a API diretamente.

## Contrato da preparação local

### Origem e superfície

- Usar inicialmente somente `https://fasemarketplace-git-development-nikolasdtesch-4933s-projects.vercel.app`, sem wildcard `*.vercel.app`. Confirmar alias/proteção efetivos antes de ativar. Deploys alternativos não devem aceitar auth apenas por pertencerem ao projeto.
- Preservar `/api/health/ready`. Expor somente GET de sessão/listagem e POST de login/logout/senha/criação/bloqueio/reset já existentes no NestJS. Especificar paths e limites na lista abaixo; handler nativo Better Auth continua ausente.
- Cada salto valida método/path e tamanho; Function não aceita URL de destino fornecida pelo visitante e não segue redirects. Gateway encaminha somente para sua API interna fixa.
- API confirma contexto Preview explicitamente e recusa combinação com Neon production. Não remover as validações do modo local atual.

| Rota Vercel proposta | Método | Regra de acesso |
| --- | --- | --- |
| `/api/access/login` | POST | Sem sessão, com origem e limitador |
| `/api/access/session` | GET | Sessão válida, incluindo pendência de senha |
| `/api/access/logout` | POST | Sessão válida, incluindo pendência |
| `/api/access/password` | POST | Sessão válida e senha atual, incluindo pendência |
| `/api/access/users` | GET | Admin sem pendência; somente offset validado |
| `/api/access/users` | POST | Admin sem pendência |
| `/api/access/users/:id/block` | POST | Admin sem pendência; sem autobloqueio |
| `/api/access/users/:id/password` | POST | Admin sem pendência; reset de outro usuário |

IDs devem ser um segmento válido e limitado; não permitir encoded slash, path traversal, query arbitrária ou encaminhamento genérico. O detalhamento de implementação deve fixar validação compatível com IDs efetivos do Better Auth 1.7.12.

### Sessões e origem

- Preview usa segredo e prefixo próprios; cookie Secure, HttpOnly, host-only, SameSite=Lax, path `/`. Não definir Domain amplo. Manter oito horas, renovação a partir de uma hora e cookie cache desabilitado, como no local. Forçar `advanced.useSecureCookies=true` no contexto remoto; esse controle é documentado oficialmente. [Better Auth — Secure cookies](https://www.better-auth.com/docs/concepts/cookies#secure-cookies).
- Preservar separadamente cada Set-Cookie de criação, renovação e logout. Não juntar por vírgula nem devolver token em JSON. Não encaminhar cookies de proteção Vercel ou cookies alheios ao prefixo auth aprovado.
- Operações com efeito exigem Origin exatamente igual à origem canônica e JSON de até 8 KiB. Origem ausente/null/forjada ou Sec-Fetch-Site cross-site resulta em recusa; não substituir uma origem inválida pela origem canônica antes de verificar.
- Não desabilitar CSRF/origin checks do Better Auth. A biblioteca documenta `trustedOrigins` e os riscos de desligar essas proteções; o wrapper NestJS continua exigindo origem explicitamente. [Better Auth — segurança](https://www.better-auth.com/docs/reference/security#csrf-protection).
- Respostas de acesso usam no-store, DTO mínimo, erros genéricos e nenhum payload em PostHog. Sessões permanecem no servidor; sem localStorage/sessionStorage.

### Ponte e identidade de rede

- Separar credencial servidor-servidor da sessão do usuário. O gateway deve autenticar a chamada antes de encaminhar; o backend precisa distinguir transporte verificado de headers enviados diretamente ao seu endpoint loopback.
- A Function deve extrair somente a identidade de rede fornecida pela infraestrutura Vercel, validar formato e substituir headers internos recebidos do visitante. A documentação declara que a Vercel sobrescreve X-Forwarded-For para reduzir spoofing e documenta x-vercel-forwarded-for; essa confiança só vale na borda Vercel verificada, não em qualquer cliente que envie esses nomes. [Vercel — request headers](https://vercel.com/docs/headers/request-headers#x-forwarded-for).
- A API verifica a segunda credencial exclusiva do gateway antes de aceitar os metadados, conforme o contrato de execução abaixo; não confiar apenas na presença de um header ou no IP da rede Docker. Rotação e ativação operacional ficam no gate remoto.
- Preservar limite por IP/e-mail e agregado por IP, com HMAC e namespace Preview no Redis. Dois clientes não devem compartilhar limite por causa do IP da Function; o visitante não deve escapar do limite forjando um header. Header confiável ausente/inválido deve recusar login, sem fallback silencioso para identidade escolhida pelo cliente.

O mecanismo de autenticação de metadados está fechado no contrato de execução abaixo.

### Dados, bootstrap e recuperação

- AUTH remota fica desligada até validar destino Neon development, role limitada, segredo/cookie/Redis próprios e proteção Vercel. Nomes finais das novas variáveis e consumidores serão fixados na aprovação do contrato; não preencher exemplos com um contrato ainda indefinido.
- Migrations versionadas e checksum; DDL somente pelo comando autorizado, nunca startup ou role runtime. Não retirar a restrição local de `scripts/auth-local.mjs` para apontá-lo ao Neon.
- Obter backup atualizado e ensaiar restauração isolada, com sessões restauradas revogadas, antes da migration remota. Não copiar conta/senha genérica local para Preview.
- Bootstrap remoto por operação privada explícita e sem rota HTTP de bootstrap. Definir recuperação do único administrador, responsável e identidade efetiva de destino antes da ativação; nunca adicionar bypass público.
- Rollback desativa somente auth Preview, bloqueia seus caminhos na Function/gateway e revoga suas sessões quando autorizado; não apaga usuários/tabelas ou desativa diagnóstico/Production.

## Critérios propostos de aceite

1. Login, sessão após recarga/renovação, logout e expiração observados no HTTPS real do alias aprovado; cookie seguro e ausência de tokens no JSON/storage.
2. Admin cria usuário com senha provisória; usuário comum não administra; pending é imposto no backend. Reset/bloqueio revogam sessões, inclusive login concorrente.
3. Origem, host, IP ou headers forjados, rotas extras, corpos excessivos e chaves incorretas recusados em testes de cada salto e do caminho completo.
4. Limitação de tentativas diferencia clientes conforme a identidade de rede verificada; Redis/túnel indisponíveis falham sem abrir acesso ou divulgar dados internos.
5. Sessão local/Production não concede acesso ao Preview; segredos não entram em VITE_, worker, bundle, logs, relatório ou PostHog.
6. Backup/restore, migration/checksum/runtime, bootstrap e rollback ensaiados; Production permanece sem schema/contas/configuração desta entrega.
7. Revisão independente, autorização de publicação/migration e homologação humana registradas separadamente. Proteção Vercel continua exigida além do login do produto.

## Pendências de homologação e operação remota

- Obter aceite humano da primeira fatia e homologar o transporte na plataforma real após autorização.
- Preparar operação/rotação das duas credenciais e os comandos de manutenção Preview.
- Recuperação privada preparada e política RPO/RTO aprovada conforme SPEC-009. Em 25/10, baseline real Neon public vazio restaurado no Docker 18; guarda somente local escolhida pelo usuário. Migration/bootstrap remoto e homologação de acesso ainda pendentes; não confundir baseline vazio com recuperação de usuários reais.
- Conferir assinatura e comportamento efetivos na versão 1.7.12; as páginas oficiais consultadas em 23/10/2026 são documentação corrente, não garantia de cada detalhe da versão instalada.
- Concluir backup, manutenção de desenvolvimento e autorização específica de publicação/migration antes de ativar o código.

## Contrato de execução — 24/10/2026

- Function exige VERCEL_ENV=preview e branch development, PREVIEW_ACCESS_ENABLED=true, origem canônica exata, túnel HTTPS fixo e chave exclusiva PREVIEW_ACCESS_BRIDGE_KEY. O padrão é desligado.
- Gateway de diagnóstico mantém seu comportamento. Rotas /access/* são opt-in e autenticadas por PREVIEW_ACCESS_BRIDGE_KEY; não aceitam a chave de diagnóstico. Gateway substitui Authorization por uma segunda credencial PREVIEW_ACCESS_API_KEY, compartilhada somente com a API. As duas chaves devem diferir entre si, do segredo auth e da chave de diagnóstico.
- Function descarta metadados recebidos do visitante e deriva x-fm-client-ip exclusivamente de x-vercel-forwarded-for (IP único válido normalizado). Gateway só repassa esse valor após verificar a chave da Function. API só usa esse valor depois de verificar a chave da API, em comparação constante. Sem credencial/metadado válido, recusa antes de consultar sessão ou limitar login; nunca confiar em X-Forwarded-For direto nem no IP do proxy.
- API exige AUTH_CONTEXT=preview, APP_ENV=local, DATABASE_PROVIDER=neon, NEON_BRANCH=development e endpoint development validado pelo contrato existente, sem aceitar endpoint production. AUTH_DATABASE_URL e DATABASE_URL são iguais, usando exclusivamente a role fm_auth_preview_runtime, mesmo banco/host e TLS verify-full; conexão proprietária não entra na API. AUTH_COOKIE_PREFIX=fm_preview_access, segredo exclusivo e Secure obrigatório. Contexto local continua inalterado.
- Cookies transportados somente do namespace __Secure-fm_preview_access; máximo 4 KiB de header de cookie. Respostas de auth limitadas a 64 KiB, JSON/DTOs sanitizados. Preservar cada Set-Cookie autorizado com Secure/HttpOnly/SameSite=Lax/Path=/ e sem Domain, incluindo remoção/renovação. Não encaminhar _vercel_jwt nem cookies de plataforma.
- Headers de autorização e identidade de rede não entram em respostas, logs ou telemetria. Erros do upstream normalizados; sem Location, redirects, tokens JSON ou cache. POST limitado a 8 KiB; queries somente offset numérico validado em listagem.
- Composição remota será um override explícito novo, sem alterar/ativar os Composes de diagnóstico existentes. Nenhuma variável nova é preenchida na Vercel nesta execução.
- Recuperação do único admin por comando offline restrito a development: valida destino, exige entrada privada, redefine senha e pendência e revoga sessões; sem endpoint público, sem reabrir bootstrap, sem ampliar para Production. Backup antes da migration remota e restore descartável com sessões revogadas são pré-condições. RPO/RTO/retencão precisam ser acordados antes de homologar operação remota.
- Adapter da Function consome somente um parâmetro reservado `path` quando seu valor é idêntico ao sufixo real de `/api/access/` injetado pelo catch-all Vercel. Ele nunca seleciona rota pelo query param; valor divergente/duplicado não é removido e continua recusado. Outras queries seguem contrato estrito (somente offset em GET users). Gateway/API não relaxam allowlist.

### Manutenção privada — preparação local

Comando dedicado `scripts/auth-preview.mjs`, separado da manutenção local. Owner somente no processo privado, endpoint direto correspondente ao runtime pooled confirmado, mesmo banco e TLS verify-full; nunca na API/gateway/Function. Conexão direta mantém lock de sessão durante chamadas Better Auth. Bootstrap exige troca da senha provisória; recuperação mantém identidade/perfil/bloqueio e revoga sessões antes/depois do reset oficial. Nenhuma rota nativa de reset ou bootstrap é publicada. Contrato e comandos em [preview-access-maintenance.md](../operations/preview-access-maintenance.md). Execução Neon permanece condicionada a backup/restore e autorização.
