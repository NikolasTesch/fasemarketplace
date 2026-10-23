# Hybrid development implementation plan

> Execute inline with superpowers:executing-plans. No automatic commits.

**Goal:** prepare opt-in Docker + Neon development and static Vercel frontend.
**Architecture:** preserve local Compose; separate hybrid Compose, strict pooled Neon endpoint allowlist and verified TLS. API/worker remain local. Public API access and deployment await protected transport and account setup.
**Tech Stack:** existing React/Vite, NestJS, pg, Redis, Docker.
**Spec:** docs/specs/SPEC-003-hybrid-development.md

- [x] Add failing tests to local-config.test.cjs for opt-in Neon and malformed/unsafe configurations.
- [x] Implement Neon configuration and cost-aware readiness interval; preserve local defaults.
- [x] Add independent hybrid Compose, ignored env template and Vercel static build settings; add configurable HTTPS API URL and strict CORS origins.
- [x] Validate lint/typecheck/tests/build, Compose and local smoke; inspect security-sensitive settings.
- [x] Review and document actual provisioning outcome and remaining dashboard steps.

## Execution notes

- Current Git has no commits, all bootstrap work is in this checkout; no worktree can be based on HEAD. Preserve this checkout and do not invent a commit.
- Neon CLI is unavailable. Authenticated MCP found two organizations; user selected Vercel-managed organization. Project creation returned action restricted: organization is managed by Vercel. No project or credentials created.
- Current frontend needs no Cloud Function; do not add a proxy without defined authorization semantics.
- Do not publish API without authentication. CORS alone is not access control.
- Manual creation is now explicitly requested: no further provisioning attempts. `.env` fields added without replacing existing values.
- Reviewer found project-name collision: all hybrid commands now explicitly require `-p fasemarketplace-hybrid`; resolved config proves Redis volume isolation.
- Reviewer found initial Redis connection race: regression test failed before fix, passed after bounded 5s retries followed by 10min steady-state/failure backoff.
- Remote provisioning, connection test and Vercel/tunnel exposure remain pending user-created resources; no commit, push or deploy.
