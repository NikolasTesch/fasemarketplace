# SPEC-007 — Login e controle de acesso local

**Estado:** implementada e validada no Docker local, conforme aprovação do usuário. Sem publicação ou ativação remota. Evidências e operação em [local-access.md](../operations/local-access.md).

## Objetivo e decisões confirmadas

Entregar a primeira fatia do RF-01 do PRD: acesso ao piloto de uma única empresa, com usuários identificados e autorização verificada no NestJS. O usuário escolheu login por e-mail e senha, criação/liberação de usuários exclusivamente pelo administrador e Better Auth hospedado no NestJS para preservar o funcionamento local em Docker. Cadastro público fica fechado.

O usuário aprovou o desenho completo para implementar e validar no Docker local. O backlog numerado no PRD era uma proposta anterior; os identificadores dos arquivos reais de specs prevalecem. Esta SPEC-007 não representa a antiga proposta de vínculos de marketplace.

## Abordagens consideradas

- **Neon Auth gerenciado:** operações de identidade delegadas ao Neon, com funções administrativas; adiciona dependência remota ao login. Avaliado, não escolhido.
- **Better Auth no NestJS:** escolhido pelo usuário. A biblioteca cuida de senhas e sessões; o projeto assume configuração, atualizações, persistência e administração de acesso. Permite testar com PostgreSQL e Redis inteiramente locais.

Better Auth `1.7.12` fixado após conferir compatibilidade e dependências. Na implementação, a API programática oficial substitui o handler nativo: controllers/guards NestJS verificam origem e autorização, encaminham Set-Cookie e retornam DTOs sem tokens. Isso mantém fechadas as rotas nativas extras, sem adaptador comunitário NestJS. A biblioteca continua responsável por hashing e sessões.

## Escopo desta fatia

Implementar e testar no Compose padrão, em dados sintéticos. O frontend continua React/Vite e usa `/api` na mesma origem; autenticação, sessão e permissões pertencem ao backend. API e worker continuam separados, mas o worker não inicializa servidor de autenticação nem recebe seu segredo.

O desenho não ativa autenticação no híbrido, Preview ou Production. A integração remota exige outra fatia para cookies/origens, transporte autenticado e validação antes de ampliar os gateways, que hoje aceitam apenas diagnóstico GET. Não criar usuário real, executar migration no Neon ou publicar esta mudança durante a implementação local.

## Usuários, permissões e ciclo de vida

Dois perfis técnicos iniciais: `admin` e `user`. Eles não aprovam a futura matriz de permissões de estoque, integração e consulta descrita pelas personas do PRD; essa matriz será detalhada com as funcionalidades correspondentes.

| Ação | Sem sessão | Usuário ativo | Administrador ativo |
| --- | --- | --- | --- |
| Login e diagnóstico técnico sanitizado | Permitido | Permitido | Permitido |
| Ver o próprio perfil e sair | Recusado | Permitido | Permitido |
| Trocar a própria senha | Recusado | Permitido com senha atual | Permitido com senha atual |
| Listar/criar usuários e bloquear/desbloquear acesso | Recusado | Recusado | Permitido |
| Redefinir senha de outro usuário | Recusado | Recusado | Permitido com revogação de sessões e troca obrigatória |

- O primeiro administrador nasce por comando local explícito, com entrada interativa da senha, sem credenciais em argumentos, logs, Git ou exemplo env. O bootstrap recusa execução se já houver administrador; não cria conta padrão nem senha fixa. O comando também recusa ambiente remoto/produtivo.
- Criação administrativa exige nome, e-mail único, perfil técnico e senha provisória. Usuários criados e usuários com senha redefinida ficam com troca obrigatória pendente. O administrador entrega a credencial por canal privado fora do sistema; esta fatia não envia e-mails.
- Após login com senha provisória, permitir somente consulta mínima da sessão, troca de senha e saída. A restrição é verificada no servidor, inclusive se o cliente chamar endpoints diretamente. A nova senha deve diferir da provisória.
- Criar ou redefinir senha atribui a pendência no servidor, sem aceitar campo arbitrário do cliente para ignorá-la. Troca bem-sucedida remove a pendência e revoga as outras sessões. Falha ao atualizar a pendência mantém o acesso restrito.
- Bloqueio revoga sessões e impede novos logins; desbloqueio não restaura sessões anteriores. Recusar autobloqueio do administrador e ações que removam o último administrador ativo. Exclusão, mudança de perfil e impersonação ficam fora da primeira interface/API exposta.
- Erros de credenciais não distinguem e-mail inexistente, senha incorreta ou conta bloqueada. Nome/e-mail somente nas respostas autorizadas necessárias; não enviar senhas, tokens, cookies ou dados pessoais ao PostHog.

## Sessões, transporte e superfície exposta

- Senhas com mínimo de 12 e máximo de 128 caracteres, espaços permitidos e sem truncamento. Better Auth aplica hashing/verificação. Erros de validação não ecoam senhas.
- Sessão persistida no PostgreSQL, cookie HttpOnly, host-only, SameSite=Lax, prefixo específico do ambiente. Nenhum token em localStorage/sessionStorage ou JSON de resposta. Proposta de expiração: oito horas, renovação no máximo a cada hora; testes observam a configuração efetiva. Cache de sessão em cookie fica desligado para que bloqueios e permissões sejam conferidos no servidor.
- HTTP/cookie sem Secure permitido somente no loopback de desenvolvimento local. O futuro modo remoto exigirá HTTPS/Secure e origem canônica própria; não tentar compartilhar cookie entre portas ou ambientes. Mesmo host local pode compartilhar cookies entre portas, portanto cada stack precisa de prefixo e segredo distintos antes de receber auth.
- `Origin`/origens confiáveis exatos e controles CSRF da biblioteca permanecem ativos; sem wildcard de origem, desativação de checagens ou confiança em headers de proxy arbitrários. O proxy Vite local permanece configurado explicitamente para a origem local correta.
- Allowlist de rotas e métodos: somente login, sessão atual, logout, troca de senha e as ações administrativas acima. O cadastro público deve ser recusado na configuração da biblioteca e pela superfície HTTP, incluindo chamada direta sem interface. Endpoints nativos de impersonação, exclusão e APIs administrativas não aprovadas não ficam acessíveis.
- Guards do NestJS e verificações nos serviços cobrem toda a superfície aprovada, inclusive troca obrigatória. O handler nativo não é exposto; DTOs retornam somente usuário autorizado e metadados mínimos de validade de sessão.
- Limitar corpos JSON a 8 KiB; rejeitar conteúdo/método não permitido. Limitação de tentativas de login por origem de rede e e-mail normalizado, sem usar e-mail puro em logs/chaves. Proposta: cinco falhas por combinação em 15 minutos e limite agregado por origem; contador persistido no Redis local, falha do limitador recusa a tentativa sem travar diagnósticos. Não confiar em X-Forwarded-For enviado pelo cliente. Definir números/testes exatos do limite agregado no plano.

## Persistência e configuração

Gerar migrations versionadas a partir do schema da biblioteca fixada e das extensões aprovadas, com prefixo de tabelas `auth_` para separar identidade da futura persistência de negócio. Sem escolher ORM geral do produto nesta entrega; usar PostgreSQL/pg já presentes e adapter documentado da biblioteca.

Registrar migrations aplicadas e checksum, inicializar por comando explícito e testar reaplicação sem perda de dados. API não executa DDL no startup. Usar permissão de migration separada do runtime; não conceder DDL ao runtime produtivo limitado. Executar migrations e seeds somente no PostgreSQL local, preservando volumes existentes. Registrar procedimento de backup/restauração local antes de aplicar schema em volume persistente; teste de restore em banco descartável, sem sobrescrever o banco original.

Preparar segredo auth local aleatório de pelo menos 32 bytes e origem explícita no `.env` ignorado; exemplos fictícios/vazios. Nenhum segredo de auth no Vite, worker, Vercel ou imagens. Ativação local deve ser explícita; os Composes híbrido/produtivo e seus serviços ativos permanecem com auth desabilitada até especificar e autorizar a etapa remota.

## Interface

Usar identidade existente em `docs/design.md`: logo Fase Sport, vermelho `#C9151B`, superfície clara e formulário acessível/responsivo. Login contém e-mail/senha, ação Entrar, estados de envio/erro e opção de mostrar senha. Não oferecer cadastro público, Google, convite por e-mail ou recuperação automática ainda não implementada.

Após login normal, mostrar usuário/perfil, diagnóstico e ação Sair. Troca obrigatória ganha tela própria; página administrativa mostra lista paginada e ações aprovadas com confirmação de bloqueio/redefinição. Exibir mensagens claras para sessão expirada, indisponibilidade e acesso recusado. Um usuário comum não vê ações administrativas, e sua ausência visual não substitui a verificação no backend.

## Critérios de aceitação e verificação

1. Docker local inicia com autenticação configurada; bootstrap cria apenas o primeiro administrador e exige senha privada. Híbrido/Production existentes continuam saudáveis e não recebem schema/usuários/segredos desta fatia.
2. Login/logout, recarga com sessão persistida, expiração e revogação funcionam. Senha provisória não permite acessar administração ou área autenticada antes da troca. Tokens não aparecem em JSON, bundle, storage do navegador ou logs.
3. Administrador cria usuário; e-mail duplicado é recusado. Usuário comum recebe 403 nas rotas administrativas; sem sessão recebe 401. Campo role/pendência adulterado pelo cliente não eleva privilégios.
4. Cadastro público direto é recusado. Bloqueio e redefinição invalidam sessões; último administrador e autobloqueio têm proteção. Nova senha libera o usuário apenas após sucesso no servidor.
5. Testes de CSRF/origem, limite de tentativas, falha de Redis, corpo excessivo, métodos/rotas extras, enumeração e respostas sem segredos. Testar chamadas diretas, não apenas a interface.
6. Migrations verificadas em PostgreSQL descartável, reaplicação/checksum e restauração local ensaiada. Nenhum reset ou remoção de volume. A role Neon produtiva permanece sem permissões novas.
7. Lint, typecheck, testes, build e smoke real da interface no Docker, com credenciais sintéticas. Revisão independente antes de concluir. Commit/push/publicação continuam sujeitos ao workflow e autorização da entrega; aprovação desta spec autoriza implementação e testes locais.

## Fora do escopo e referências

Convites e recuperação por e-mail, Google/OAuth, MFA, múltiplas empresas, papéis de negócio, auditoria geral do domínio e exposição de auth na Vercel ficam para specs posteriores. Sem contratação de serviço ou configuração de SMTP nesta fatia.

- [Better Auth: email/senha e troca de senha](https://www.better-auth.com/docs/authentication/email-password)
- [Better Auth: administração e bootstrap](https://www.better-auth.com/docs/plugins/admin)
- [Better Auth: integração Express/Node](https://www.better-auth.com/docs/integrations/express)
- [Integração NestJS comunitária avaliada](https://www.better-auth.com/docs/integrations/nestjs)
- [Neon Auth: alternativa administrativa avaliada](https://neon.com/docs/auth/guides/plugins/admin)
