# SPEC-005 — Ponte autenticada para diagnóstico em Preview

## Objetivo

Preparar o frontend Vercel para consultar a API Docker sem domínio próprio e sem expor segredos ao navegador. Escopo inicial restrito ao diagnóstico GET /health/ready. Não é autenticação de usuários nem uma API de produto.

## Desenho

Browser → /api/health/ready na Vercel (Function) → URL HTTPS temporária → gateway autenticado Docker → API híbrida → Neon. O gateway é um serviço opt-in separado da API para preservar a interface local em 4273 e os healthchecks existentes. A chave privada fica somente no gateway e na Function; nunca em VITE_. A Function reconstrói headers e retorna apenas o contrato sanitizado do diagnóstico.

O túnel temporário Cloudflare Quick Tunnel é uma opção documentada sem conta/domínio, cuja URL muda ao reiniciar. Não instalá-lo nem iniciá-lo nesta preparação. A escolha/ativação externa permanece manual; não alterar DNS, contratar planos ou publicar sem configuração concreta revisada. A única origem remota aceita nesta primeira implementação é um hostname HTTPS trycloudflare.com, sem credenciais, porta, path ou query.

## Critérios

- Gateway recusa chave ausente/incorreta antes de consultar a API. Chave aleatória de pelo menos 32 bytes, comparação em tempo constante.
- Somente GET /health/ready; bloquear outras rotas, queries, métodos e redirects. Sem encaminhar cookies, headers do navegador, corpos, mensagens de erro ou headers do upstream.
- Respostas pequenas, timeout e cache-control no-store; falhas retornam diagnóstico genérico, sem detalhes internos.
- Function desligada por padrão e bloqueada em VERCEL_ENV=production; ativação exige ambiente preview, configuração válida e PREVIEW_BRIDGE_ENABLED=true.
- Antes de ativar em nuvem, configurar e verificar Deployment Protection no Preview: chave entre servidores não autentica usuários do frontend.
- Compose opt-in independente de produção, somente gateway loopback 4374; não expor a API 4274 pelo túnel nem publicar Redis/banco.
- Preparar campos vazios no env e roteiro de ativação manual. Nenhum túnel público, deploy, escrita de negócio ou mudança produtiva nesta entrega.

## Verificação

Testes HTTP reais locais para gateway sem/com chave, contrato sanitizado e rotas bloqueadas; testes da Function com transport interceptado para garantir segredo apenas servidor, desligamento em produção, falhas/redirect/body inválido. Smoke real contra API híbrida/Neon via gateway local. Checks existentes e frontend local continuam passando.

## Evidência — 23/10/2026

- Testes escritos antes dos módulos, inicialmente falhando; sete testes da ponte passaram após implementação, incluindo limites de concorrência, rotas/métodos e respostas inválidas. Chave não é encaminhada para a API interna.
- Build Docker de verificação passou em instalação limpa: lint, typecheck dos workspaces, 50 testes totais e build.
- Gateway local em 4374 testado: sem chave 401; com chave, diagnóstico real ready de API/Neon/Redis. Smokes híbrido e totalmente local passaram. Chave gerada no `.env` ignorado sem exibir valor.
- Revisão independente não encontrou achados importantes e reexecutou sete testes da ponte.
- Cloudflared não instalado/iniciado; nenhum túnel, DNS, deploy, commit ou push. Empacotamento Vercel e proteção externa permanecem sem homologação.
