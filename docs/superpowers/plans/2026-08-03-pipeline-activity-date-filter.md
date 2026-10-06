# Pipeline Activity Date Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow pipeline users to filter leads by creation, latest update, latest stage movement, or any logged activity across the existing time periods.

**Architecture:** Add a security-invoker Supabase RPC that aggregates `lead_logs` per accessible lead, avoiding row limits and bulk history transfer. Keep date-selection/filtering rules in a pure TypeScript module, load the aggregate in `useLeadFilters`, and expose a compact selector in `LeadFiltersBar`.

**Tech Stack:** Next.js 14, React 18, TypeScript, Supabase/PostgreSQL, Vitest.

## Global Constraints

- Keep **Criação** as the default date basis.
- Preserve existing Hoje/Ontem/7/30/90/Todos semantics.
- Respect existing `lead_logs` RLS through a `security invoker` function.
- Do not treat `lead_criado` as an update.
- Do not fetch raw log history into the browser.

---

### Task 1: Pure date-basis filtering rules

**Files:**
- Create: `src/lib/lead-period-filter.ts`
- Test: `src/lib/lead-period-filter.test.ts`

**Interfaces:**
- Produces: `DataReferencia`, `LeadActivityDates`, `isLeadWithinPeriod(...)`.

- [ ] **Step 1: Write failing tests**

Cover creation, update, stage movement, any activity, missing activity, inclusive seven-day boundary, and the bounded “ontem” interval using a fixed `now`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/lead-period-filter.test.ts`
Expected: FAIL because `lead-period-filter` does not exist.

- [ ] **Step 3: Write minimal implementation**

Resolve the selected timestamp and compare it with local-day boundaries. Return all leads for `todos`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/lead-period-filter.test.ts`
Expected: PASS.

### Task 2: Aggregated activity RPC

**Files:**
- Create: `supabase/migrations/0019_lead_activity_filter_rpc.sql`
- Test: `src/lib/crm-automotivo.test.ts`

**Interfaces:**
- Produces RPC `get_lead_activity_dates()` with `id_lead`, `ultima_atualizacao`, `ultima_movimentacao`, and `ultima_atividade`.

- [ ] **Step 1: Add a failing migration contract test**

Assert that migration 0019 creates a security-invoker function, excludes `lead_criado` from updates, and isolates `estagio_alterado` for movement.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/crm-automotivo.test.ts`
Expected: FAIL because migration 0019 is absent.

- [ ] **Step 3: Add minimal SQL migration**

Aggregate visible `lead_logs` rows by `id_lead` and grant execution to `authenticated`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/crm-automotivo.test.ts`
Expected: PASS.

### Task 3: Hook and UI integration

**Files:**
- Modify: `src/hooks/useLeadFilters.ts`
- Modify: `src/components/LeadFiltersBar.tsx`
- Modify: `src/app/(app)/pipeline/page.tsx`

**Interfaces:**
- Consumes: `get_lead_activity_dates()` and `isLeadWithinPeriod(...)`.
- Produces: `dataReferencia`, `setDataReferencia`, loading/error-safe activity state.

- [ ] **Step 1: Extend tests with option/default contracts**

Assert the four UI options and pure default behavior before production edits.

- [ ] **Step 2: Run focused tests and verify failure**

Run the focused Vitest files and confirm missing exports/options cause the failure.

- [ ] **Step 3: Implement minimal hook integration**

Fetch the RPC once alongside filter metadata, map rows by lead ID, use the pure filter helper, and reset the date basis to creation in `limparFiltros`.

- [ ] **Step 4: Add the selector to the filter bar**

Render “Data considerada” with Criação, Última atualização, Movimentação de etapa, and Qualquer atividade.

- [ ] **Step 5: Run focused and full verification**

Run: `npm test`, `npm run build`.
Expected: all tests and production build pass.

