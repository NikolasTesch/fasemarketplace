# Execução E01.1 — Login integrado ao protótipo

Plano: [integrações do MVP](../superpowers/plans/2026-10-24-mvp-integrations.md). Data: 24/10/2026.

## Estado

**E01.1 implementada e validada tecnicamente no Docker local.** Homologação humana permanece pendente. E01 completa ainda exige desenho e homologação do acesso Preview. E02–E07 não implementadas por esta fatia.

Branch `codex/mvp-access-integration`, base `7236a4612961538445508b1b73eafbefe7491213`. Alterações ainda sem commit; nenhum push, merge ou deploy nesta execução. Trabalho do checkout original preservado.

## Alterações

- Portada seletivamente a autenticação da SPEC-007, anteriormente isolada no checkout original, junto de testes, migration versionada, scripts e dependências fixadas. Não copiados arquivos env privados.
- App usa Access quando a flag pública local está ativa; sem sessão ou com senha provisória pendente não monta InventoryApp.
- Contexto `useAccessUser` entrega a identidade da sessão ao shell; o operador fictício aparece somente no modo demonstração sem auth. Perfil/administração continuam verificados no backend.
- CSS de acesso não sobrescreve os botões do protótipo. Navegação responsiva e aviso de dados fictícios foram preservados.
- Estoque, pedidos, sincronização e gráficos continuam simulados. Esta fatia integra somente identidade/sessão/permissões técnicas; não cria persistência de negócio.

## Ambiente local desta entrega

Stack **`fasemarketplace-mvp-access`**, `.env` ignorado neste worktree, volumes/redes/segredos próprios. Não confundir com as stacks local original, híbrida ou Production.

- Interface: [http://127.0.0.1:4773](http://127.0.0.1:4773).
- API/readiness: `http://127.0.0.1:4774/health/ready`.
- PostgreSQL/Redis sem porta no host; worker sem segredo de autenticação. Web recebe apenas VITE_AUTH_ENABLED, não AUTH_SECRET ou conexão do banco.
- Administrador temporário genérico criado por autorização do usuário. A credencial é fornecida diretamente ao usuário, não neste documento, no Git ou em argumentos de processo. Troca obrigatória ativada e sessões administrativas revogadas após os testes.

A stack continua ativa para validação. Comandos, neste worktree:

```powershell
docker compose ps
pwsh -NoProfile -File scripts/verify-local.ps1
# Parar preservando volumes:
docker compose stop
```

Os exemplos gerais usam 4173/4174; a configuração privada desta stack substitui por 4773/4774 para isolar ambientes. Não copiar conexões ou chaves entre eles.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Anônimo com flag ativa, antes da integração | RED: InventoryApp era montado sem sessão |
| Mesmo cenário após integração | GREEN: login visível e produto ausente |
| Docker verify | Lint, typecheck, 56 testes regulares e build passaram |
| Integração em PostgreSQL descartável + Redis | 13 testes passaram, incluindo bootstrap concorrente, CSRF, revogação e corrida login/reset |
| Browser `scripts/verify-access-ui.mjs` | Admin, identidade real, CSS/brand, cadastro, pending sem produto, troca, usuário comum 403, reload, bloqueio, reset, logout, mobile 390px, HttpOnly, sem storage/erros passaram |
| Modo demonstração sem flag | Protótipo acessível e nenhuma chamada `/api/access`; container temporário removido |
| Smoke local | Cinco serviços saudáveis, loopback e proxy web/API/DB/Redis corretos |
| Runtime auth | DML permitido; CREATE no schema recusado |
| Backup/restore | Dump `backups/mvp-access-20261024094116.dump`; restore isolado `fm_auth_restore_mvp_20261024094116`; dois usuários no original e no restore, sessões do clone eliminadas |
| Revisão independente | Sem P1/P2 concreto restante na integração local |

O backup foi feito no banco sintético desta stack; isso não homologa recuperação do Neon, retenção, cifragem ou RPO/RTO de Production. Esses pontos pertencem à E02.

## Repetir o smoke de navegador

O teste exige **administrador sintético sem troca pendente**, em uma origem loopback. Cria outro usuário sintético e modifica somente esse acesso; não apontar a dados importantes. Na conta de demonstração entregue ao usuário, concluir a troca obrigatória antes de reutilizá-la como fixture e atualizar sua senha no arquivo privado.

Criar um JSON privado ignorado (ex.: `.env.access-ui.json`) com `origin`, `email`, `password` e `name`. Definir `ACCESS_UI_FIXTURE` para esse caminho, `PLAYWRIGHT_MODULE` para instalação do Playwright disponível no ambiente e, se necessário, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` para Chromium. Executar:

```powershell
node scripts/verify-access-ui.mjs
```

Não passar senha em argumentos nem registrar cookies. O teste desta stack espera prefixo `fm_mvp_access`; ajustar o teste/fixture ao validar outra configuração. A integração backend exige banco descartável `fm_auth_test_*` previamente migrado e conexão privada no mesmo ambiente; nunca limpar fixtures no banco persistente.

## Próximo gate

Fechar SPEC-008 para acesso Preview: decidir transporte, verificação dos metadados da ponte até a API e recuperação do administrador. Somente após o desenho aprovado implementar a fatia remota; publicação e migration Neon exigem autorização operacional específica. Não interpretar o plano de sete entregas como homologação das regras de catálogo/estoque ainda pendentes.
