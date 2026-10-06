# Leads, IA e Segurança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar a exclusão segura de leads, o controle persistente da IA, o feedback de observações e a proteção contra autoelevação sem recarregar a página.

**Architecture:** O CRM é single-tenant e usa `id_empresa = 1`, `BASE_DE_LEADS`, Supabase autenticado e RLS. Operações destrutivas e de IA passam por rotas internas que validam sessão, cargo, entrada, tenant, transição/retorno do banco; o `LeadDrawer` atualiza os três consumidores por callbacks locais.

**Tech Stack:** Next.js 14, React 18, TypeScript strict, Tailwind CSS, Supabase/PostgreSQL, Vitest.

## Global Constraints

- Verificar comportamento existente antes de implementar e não duplicar soluções eficazes.
- Não remover funcionalidades existentes nem sobrescrever alterações do usuário.
- Não fazer reload completo, commit, push, deploy ou aplicação remota de migrations.
- Seguir RED → GREEN para todo comportamento novo.
- Usar cliente Supabase autenticado e manter RLS como segunda camada.

---

### Task 1: Contratos e regras testáveis

**Files:**
- Create: `src/lib/lead-management.ts`
- Create: `src/lib/lead-management.test.ts`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces: validadores de entrada, normalização do estado da IA, formatação do timestamp e validação das respostas confirmadas.

- [ ] **Step 1: Write the failing tests**

Cobrir IDs inteiros positivos, booleano estrito, `bot_ativo` legado, timestamp inválido, confirmação exata de exclusão e confirmação completa da transição da IA.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/lead-management.test.ts`
Expected: FAIL porque `lead-management.ts` ainda não existe.

- [ ] **Step 3: Write minimal implementation**

Implementar funções puras pequenas e tipar `bot_ativo: boolean | string`, `bot_ativo_alterado_em: string | null`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/lead-management.test.ts`
Expected: PASS.

### Task 2: Schema e segurança no PostgreSQL

**Files:**
- Create: `supabase/migrations/0013_lead_ia_controle.sql`
- Create: `src/lib/database-security.test.ts`

**Interfaces:**
- Produces: `bot_ativo boolean not null default false`, `bot_ativo_alterado_em timestamptz`, trigger de timestamp e policy de delete gerencial.
- Reuses: proteção de autoelevação eficaz em `0012_jotap_rls_hardening.sql`.

- [ ] **Step 1: Write the failing tests**

Ler as migrations e exigir normalização de nulos, default/NOT NULL, `now()`, `IS DISTINCT FROM`, preservação do timestamp, SQLSTATE `42501` para alteração de cargo e policy sem auto-update.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/database-security.test.ts`
Expected: FAIL nas regras de IA ainda ausentes.

- [ ] **Step 3: Write minimal migration**

Adicionar migration idempotente, sem executar remotamente. Manter `0012` como proteção de cargo e melhorar seu erro para SQLSTATE `42501` somente se o teste revelar lacuna.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/database-security.test.ts`
Expected: PASS.

### Task 3: Rotas internas autenticadas

**Files:**
- Create: `src/app/api/leads/[id]/route.ts`
- Create: `src/app/api/leads/[id]/ia/route.ts`
- Create: `src/lib/lead-api.test.ts`

**Interfaces:**
- Consumes: validadores de `lead-management.ts`, `createClient()` autenticado e cargos de `roles.ts`.
- Produces: `DELETE /api/leads/:id` e `PATCH /api/leads/:id/ia`.

- [ ] **Step 1: Write the failing tests**

Exigir validação de sessão/cargo, `.eq('id_empresa', 1)`, retorno do registro apagado, condição atômica `.eq('bot_ativo', !ativo)` e confirmação de ID/estado/timestamp.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/lead-api.test.ts`
Expected: FAIL porque as rotas ainda não existem.

- [ ] **Step 3: Write minimal routes**

Retornar 400 para entrada inválida, 401 sem sessão, 403 sem cargo de gestão, 404 para retorno vazio/incompatível e resposta genérica sem revelar registros de outro tenant.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/lead-api.test.ts`
Expected: PASS.

### Task 4: Drawer acessível e estado local

**Files:**
- Modify: `src/components/LeadDrawer.tsx`
- Modify: `src/app/(app)/leads/page.tsx`
- Modify: `src/app/(app)/pipeline/page.tsx`
- Modify: `src/components/NegociacaoTimerWatcher.tsx`
- Create: `src/lib/lead-drawer-contract.test.ts`

**Interfaces:**
- Adds: `onDeleted(leadId: number)` ao drawer.
- Reuses: `onUpdated(lead)` para IA e observações.

- [ ] **Step 1: Write the failing tests**

Exigir textos, modal `role="dialog"`/`aria-modal`/`aria-labelledby`, loading e erro de exclusão, IA com `aria-pressed`/`aria-live`, feedback exato de observação e callbacks de remoção nos três consumidores.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/lead-drawer-contract.test.ts`
Expected: FAIL nas seções ausentes.

- [ ] **Step 3: Write minimal UI**

Implementar modal não fechável durante request, atualização não otimista da IA, sucesso de observação somente após retorno confirmado e remoção local em todos os consumidores.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/lead-drawer-contract.test.ts`
Expected: PASS.

### Task 5: Consultas e verificação final

**Files:**
- Modify: `src/app/(app)/leads/page.tsx`
- Modify: `src/app/(app)/pipeline/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/components/NegociacaoTimerWatcher.tsx`
- Modify: `src/components/NovoLeadModal.tsx`

**Interfaces:**
- Ensures: todo lead completo inclui `bot_ativo, bot_ativo_alterado_em`.

- [ ] **Step 1: Write/update the failing contract test**

Exigir os dois campos em cada select que produz `BaseDeLeads`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL nos selects sem timestamp.

- [ ] **Step 3: Update queries and new-lead defaults**

Adicionar os campos sem alterar webhooks de negociação, que são um fluxo separado do controle da IA.

- [ ] **Step 4: Verify the complete project**

Run: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, `git diff --check`, busca por webhook/n8n no novo fluxo e revisão do diff.
Expected: todos verdes; migration permanece apenas local.

