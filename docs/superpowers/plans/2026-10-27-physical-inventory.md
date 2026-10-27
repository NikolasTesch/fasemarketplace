# Physical Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not publish, merge, or alter Preview/Production.

**Goal:** Persist auditable per-SKU physical stock with shared/separate marketplace buckets, editable minimums, and synthetic opening balances for current local catalog variants.

**Architecture:** NestJS owns validation, authorization, and atomic inventory transactions. Prisma stores immutable movements, a single local mode setting, and one minimum per variant; balances are derived from the movement ledger. React displays stock, movement entry/history, and settings. All enablement and writes remain Docker-local.

**Tech Stack:** React + Vite, NestJS, Prisma 7.10.1, PostgreSQL 17/18, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-27-physical-inventory-design.md`

## Global Constraints

- Prisma owns only `business`; Better Auth and `public` remain untouched.
- No business DDL on API/worker startup; migrations run explicitly after backup.
- Local Docker only; no Neon, Preview, Production, marketplace credentials, or external writes.
- Admin and User can create stock movements; only Admin changes mode/minimum; both can read.
- The minimum is per SKU and compares against the sum of all non-duplicated buckets.
- Shared mode uses one common marketplace bucket; separate mode uses Shopee and Mercado Livre buckets.
- Mode change is rejected while incompatible buckets contain units; explicit transfers to physical reserve are required first.
- Active variants sorted by SKU receive deterministic synthetic opening quantities `25 + 7 * zeroBasedIndex` in `PHYSICAL_RESERVE`, with minimum `ceil(openingQuantity * 0.20)`; one explicit seed batch only; seed actor is `system:local-seed`.
- Do not stage or commit the preexisting catalog, users, UI, or Stitch work as part of this feature.

## Review Focus

- Duplicate submit/retry must not duplicate an opening or transfer: inventory persistence integration test asserts idempotent key conflict and unchanged balance.
- Concurrent transfers/outbound operations must not make a bucket negative or lose units: PostgreSQL integration test races two operations against one balance and asserts one atomic result.
- Switching modes with channel stock must not silently reclassify units: service test checks 409 and byte-for-byte unchanged ledger/settings.
- Shared marketplace deductions must affect the common bucket once: service test asserts shared balance and both channel views agree.
- User role must not change configuration and inactive SKUs must reject movements: integration tests assert 403/409 and no new movement rows.

---

### Task 1: Prisma inventory model and least-privilege migration

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/<timestamp>_inventory/migration.sql`
- Modify: `apps/backend/test/business.integration.mjs`
- Modify: `.env.example` only if a new local opt-in flag is needed

**Interfaces:**
- Add `InventoryMode` (`SHARED`, `SEPARATE`) and `InventoryBucket` (`PHYSICAL_RESERVE`, `SHARED_CHANNEL`, `SHOPEE`, `MERCADO_LIVRE`).
- Add `InventorySettings` singleton, `VariantStockPolicy` unique by `variantId`, and immutable `StockMovement` with actor, type, source/destination, positive integer quantity, reason, idempotency key, timestamp.
- Runtime grants include only needed SELECT/INSERT and constrained policy/settings update; no DELETE/TRUNCATE or access to `public`.

- [x] Add persistence integration cases for enum/check constraints, unique idempotency key, foreign keys, append-only runtime permissions, and no cross-schema grants.
- [x] Generate migration only on a fresh disposable `fm_business_test_generate_*` target and empty matching shadow, inspect SQL for business-only DDL/grants.
- [x] Apply in synthetic PostgreSQL 17 and 18 integration targets; SQL inspection confirms only additive inventory objects in `business`, and auth facts remained preserved.

### Task 2: Inventory service, authorization, and balance invariants

**Files:**
- Create: `apps/backend/src/inventory/config.ts`
- Create: `apps/backend/src/inventory/validation.ts`
- Create: `apps/backend/src/inventory/controller.ts`
- Create: `apps/backend/src/inventory/service.ts`
- Create: `apps/backend/src/inventory/module.ts`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/access/module.ts` only for reusable role checks if needed
- Create: `apps/backend/test/inventory.integration.mjs`
- Modify: `apps/backend/test/inventory.test.cjs`

**Interfaces:**
- `GET /inventory/stock?offset=&search=&status=` returns paginated active catalog SKUs, per-bucket balances, total quantity, minimum, and below-minimum flag.
- `GET /inventory/movements?variantId=&offset=` returns newest-first immutable movement DTOs.
- `POST /inventory/movements` accepts opening only through the guarded seed path; regular operations accept inbound/outbound/adjustment/transfer with positive quantity, source/destination where needed, reason where required, and idempotency key.
- `POST /inventory/variants/:id/minimum` changes one nonnegative integer threshold; Admin only.
- `POST /inventory/settings/mode` changes mode; Admin only and only when buckets incompatible with the target mode are empty.
- Shared and separate views are derived from ledger rows; requests cannot supply actor, current balance, or arbitrary bucket transitions.

- [x] Add unit tests for DTO rejection, bucket/mode compatibility, minimum calculation, and shared/separate balance projection.
- [x] Add PostgreSQL integration cases for atomic transfers, inbound/outbound/adjustments, idempotency, actor binding, admin/user permissions, inactive SKU rejection, mode transition guards, and two concurrent debits.
- [x] Implement one locked transaction boundary for each balance-affecting command and ledger-derived stock summaries.
- [x] Return stable sanitized 400/401/403/404/409/503 errors; set `Cache-Control: no-store` on inventory endpoints.

### Task 3: Local stock, movements, and settings screens

**Files:**
- Create: `apps/web/src/inventory/StockScreen.tsx`
- Create: `apps/web/src/inventory/MovementScreen.tsx`
- Create: `apps/web/src/inventory/MovementHistoryScreen.tsx`
- Create: `apps/web/src/inventory/InventorySettingsScreen.tsx`
- Create: `apps/web/src/inventory/inventory-api.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/inventory/components/Shell.tsx`
- Modify: `apps/web/src/inventory/types.ts`
- Modify: `apps/web/src/inventory/inventory.css`

**Interfaces:**
- Shell order is Stock → Movements → History → Catalog; initial local page is Stock.
- Stock page separates physical reserve, shared bucket or per-platform buckets, total, and per-SKU minimum alert.
- Admin sees minimum/mode editing; User sees read-only settings and can register movements.
- Movement modal/page posts to the NestJS contract from Task 2 and only reports success after persisted response.
- Loading, empty, unavailable, conflict, validation, and below-minimum states are explicit; no fixture/mocked balance appears in runtime.

- [x] Add UI contract cases for a real zero balance, an absent SKU, low minimum, shared/separate buckets, loading/error, and authorization affordances.
- [x] Implement paginated stock/history requests without browser persistence of auth or business data.
- [x] Wire entry, exit, adjustment, and transfer forms with accessible errors and confirmation before irreversible stock-out.
- [x] Update navigation/screen descriptions without restoring prototype orders/synchronization/analytics.

### Task 4: Guarded one-time local opening seed and operations guide

**Files:**
- Create: `scripts/inventory-seed-local.mjs`
- Modify: `package.json`
- Modify: `compose.catalog.yaml`
- Create: `docs/operations/physical-inventory.md`
- Modify: `docs/superpowers/specs/2026-10-27-physical-inventory-design.md` with actual evidence and any learned rule changes

**Interfaces:**
- `npm run inventory:seed-local` is explicit and refuses any non-local context, unexpected database, missing inventory schema, or existing seed batch.
- Script reads effectively active variants at execution, sorts by SKU, assigns `25 + 7 * zeroBasedIndex` units to `PHYSICAL_RESERVE`, and stores each minimum as `ceil(quantity * 0.20)`.
- Seed batch/movement IDs are stable and unique so retries cannot double-count; no runtime startup hook.
- Operations guide records exact safe backup → migration → verify → seed → smoke commands and redacts all credentials/data.

- [x] Add script-level integration cases for local target guards, empty/nonempty/second-run behavior, idempotency, varied quantities, and 20% ceiling.
- [x] Take a fresh encrypted local backup before applying migration and verify archive/decryption/restore in a new quarantine target per `business-persistence.md`.
- [x] Apply only the reviewed migration to the Docker local application database and confirm effective target and preserved catalog/auth checksums/records.
- [x] Run the explicit seed once, fetch stock and movement summaries through authenticated local UI/API, and confirm all active variants appear with opening event and minimum.
- [x] Document limitations; confirm no Neon/Preview/Production or marketplace traffic was used.

## Self-review

- Spec coverage: ledger, buckets, modes, transition guards, per-SKU minimum, roles, synthetic seed, local-only migration/backup, and UI are each owned by a task.
- API DTOs do not allow caller-supplied actor or balance; Prisma DB checks are assigned to Task 1, and transactional invariants to Task 2.
- Shared marketplace sale is an internal ledger event in this delivery; actual marketplace order/webhook ingestion is out of scope.
- Seed executes only after backup/migration and cannot run on Neon or a remote deployment.
- No Git commit/push/merge/deploy is planned; the repository has substantial preexisting uncommitted work that must remain untouched.
