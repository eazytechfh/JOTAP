# Dashboard Lead Activity Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recent lead updates and recently closed contracts visible and countable on the dashboard without misclassifying old leads as newly created.

**Architecture:** Extract the existing activity-RPC lifecycle into a reusable React hook shared by pipeline and dashboard. Keep the top KPIs creation-based and use a created-or-updated dataset for the lower seller, origin, stage, and vehicle breakdowns. Extend the daily chart with separate creation and update series.

**Tech Stack:** Next.js 14, React 18, TypeScript, Supabase/PostgreSQL, Recharts, Vitest.

## Global Constraints

- “Total de Leads” and arrival/expediente metrics remain creation-based.
- The top KPI cards remain unchanged.
- The lower breakdowns include leads created or updated in the selected period.
- A lead created in 2025 and closed in the selected 2026 period must appear in updates and closed-sale metrics.
- Activity loading failures must not hide creation-based dashboard data.
- Existing RLS and aggregate RPC remain the source of activity timestamps.

---

### Task 1: Pure dashboard activity metrics

**Files:**
- Modify: `src/lib/dashboard-metrics.ts`
- Modify: `src/lib/dashboard-metrics.test.ts`

**Interfaces:**
- Produces `getDashboardActivityMetrics(leads, activityByLead, range)` and daily activity series.

- [ ] Write failing tests for an old lead updated/closed inside the selected interval, exclusion outside the interval, current-stage validation, value summation, and creation/update daily grouping.
- [ ] Run the focused test and confirm failure due to missing exports.
- [ ] Implement the minimal pure functions.
- [ ] Run the focused test and confirm green.

### Task 2: Reusable activity-date hook

**Files:**
- Create: `src/hooks/useLeadActivityDates.ts`
- Modify: `src/hooks/useLeadFilters.ts`
- Test: `src/lib/crm-automotivo.test.ts`

**Interfaces:**
- Produces `useLeadActivityDates(enabled)` returning map, loading, loaded, error, and race-safe refresh.
- `useLeadFilters` consumes and re-exports that hook state.

- [ ] Add a failing integration contract test for shared use by pipeline filters and dashboard.
- [ ] Move the proven RPC lifecycle into the reusable hook without changing behavior.
- [ ] Run focused tests and build type checking.

### Task 3: Dashboard UI and accounting

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Test: `src/lib/crm-automotivo.test.ts`

**Interfaces:**
- Consumes reusable activity dates and pure metrics.
- Produces updated lower breakdowns and a combined creation/update daily chart.

- [ ] Add failing UI contracts ensuring no new top cards and activity-aware lower breakdowns.
- [ ] Load activity dates on dashboard and compute current/previous-period activity metrics.
- [ ] Render the activity-aware lower breakdowns and chart while leaving top KPIs unchanged.
- [ ] Surface activity load errors without blocking the base dashboard.
- [ ] Run focused tests, all tests, production build, diff checks, and independent code review.
