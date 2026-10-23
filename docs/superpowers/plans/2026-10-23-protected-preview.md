# Protected preview implementation plan

> Execute inline with superpowers:executing-plans; no automatic commit or publication.

**Goal:** prepare a server-only authenticated diagnostic bridge for a future temporary HTTPS tunnel and Vercel Preview.
**Architecture:** native Node gateway opt-in alongside Docker API; native Vercel Web handler at a fixed diagnostic path. No product auth, new dependency or public access in this delivery.
**Spec:** docs/specs/SPEC-005-protected-preview.md

- [x] Write failing tests for gateway auth, allowlist, body filtering, fail-closed Preview configuration and server-only proxy headers.
- [x] Implement native Node modules outside api and a minimal Vercel Function entrypoint; include checks in root scripts.
- [x] Add optional Docker gateway configuration and empty env fields; generate a local random key without printing or overwriting an existing one.
- [x] Run tests and real local gateway -> API/Neon smoke, local frontend checks and review.
- [x] Document exact manual activation and distinction between preparation and external verification.

## Verification and limitations

Docker verification image: lint, workspace typecheck, 50 tests and build passed. Gateway smoke verified real 401/200 behavior against hybrid API/Neon; hybrid and local smokes passed. Independent review clean; reviewer reran seven bridge tests. Public tunnel, Cloudflare setup and Vercel deployment/protection remain manual and unverified. No external publishing or commits.

## Decisions

- User has no Cloudflare account/domain and expects to use *.vercel.app. No external service created. Quick Tunnel is an optional manual route, not an active resource.
- All prior uncommitted delivery changes carried intact from origin/development base; do not commit them implicitly.
- Gateway/proxy are .mjs native Node entrypoints (same ESM approach as shared telemetry), with no runtime build requirement or dependencies; product remains TypeScript/NestJS.
