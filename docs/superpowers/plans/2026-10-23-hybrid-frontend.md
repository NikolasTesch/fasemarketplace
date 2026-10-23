# Hybrid frontend implementation plan

> Execute inline with superpowers:executing-plans. No automatic commits or publication.

**Goal:** serve a local frontend against the already verified hybrid API/Neon.
**Architecture:** add an isolated web service without backend environment inheritance; same-origin Vite proxy; explicit public development label. Keep default local Compose untouched.
**Tech Stack:** existing Docker Compose, React/Vite, PowerShell; no new dependencies.
**Spec:** docs/specs/SPEC-004-hybrid-frontend.md

- [x] Add repeatable hybrid smoke; run and observe missing web failure.
- [x] Configure hybrid web, loopback port and public metadata label; add only missing HYBRID_WEB_PORT to .env without changing existing values.
- [x] Build/start hybrid web; verify browser render, readiness, refresh, error and recovery; verify local Compose still works.
- [x] Run lint/typecheck/tests/build; review and record evidence and remaining hosted access limitations.

## Results

Hybrid and local smoke passed. Browser checks passed including simulated 503 recovery and no external requests. Lint/typecheck/43 tests/build passed inside Docker. Independent review found no important actionable issue. All changes remain uncommitted; hosted Vercel and protected tunnel are not part of this completed local delivery.

## Constraints and starting state

- Branch created from origin/development (same base as main). Existing uncommitted hostname compatibility fix and Neon operation record carried intact; no reset/stash/commit.
- Root .env contains secrets and must not be printed or copied to web.
- Explicit `-p fasemarketplace-hybrid` is mandatory to avoid root COMPOSE_PROJECT_NAME overriding Compose name.
- Remote provisioning remains manual. No production database or hosted environment changes.
