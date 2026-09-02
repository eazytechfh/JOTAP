# Redistribuição de Leads e Modo Escuro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que gestores selecionem leads (inclusive todos os resultados dos filtros), redistribuam-nos igualmente entre vendedores ativos e alternem o CRM inteiro entre temas claro e escuro.

**Architecture:** A seleção fica na página de Leads, mas a redistribuição ocorre em uma função SQL transacional `security definer`, que valida empresa, papel do usuário, IDs e vendedores ativos antes de atualizar os leads em round-robin. O tema segue a implementação já validada do AUTOJANSCAR: preferência em `localStorage`, classe `dark` no elemento `html`, script no `<head>` para evitar flash e tokens CSS compatíveis com o branding.

**Tech Stack:** Next.js 14, React 18, TypeScript, Supabase/PostgreSQL, Tailwind CSS 3, Vitest.

## Global Constraints

- Somente `admin_master`, `admin` e `gerente` podem redistribuir leads.
- Apenas vendedores ativos, não desativados e da mesma empresa entram na distribuição.
- A diferença de quantidade recebida entre vendedores deve ser no máximo 1.
- A operação deve ser atômica: todos os leads são atualizados ou nenhum é.
- “Selecionar filtrados” deve afetar todos os resultados do filtro, não apenas linhas virtualizadas visíveis.
- A preferência de tema é pessoal e local ao navegador; branding continua pertencendo ao cliente.

---

### Task 1: Regra pura de distribuição

**Files:**
- Create: `src/lib/lead-redistribution.ts`
- Create: `src/lib/lead-redistribution.test.ts`

**Interfaces:**
- Produces: `buildEqualAssignments(leadIds: number[], sellerNames: string[]): Array<{ leadId: number; sellerName: string }>`

- [ ] **Step 1: Write the failing tests** para validar divisão 5/2, divisão 2/3, entradas vazias, IDs duplicados e ordem determinística.
- [ ] **Step 2: Run test to verify it fails:** `pnpm test src/lib/lead-redistribution.test.ts`; esperado: módulo não encontrado.
- [ ] **Step 3: Implement the minimal round-robin function**, rejeitando vendedor vazio e removendo IDs duplicados sem alterar a ordem.
- [ ] **Step 4: Run test to verify it passes:** `pnpm test src/lib/lead-redistribution.test.ts`; esperado: todos PASS.

### Task 2: Redistribuição transacional e autorizada no Supabase

**Files:**
- Create: `supabase/migrations/0024_redistribuir_leads.sql`
- Create: `src/lib/lead-redistribution-contract.test.ts`

**Interfaces:**
- Produces: RPC `redistribuir_leads(p_lead_ids bigint[]) returns table(lead_id bigint, vendedor text)`.

- [ ] **Step 1: Write the failing contract test** exigindo autenticação, papel gestor, escopo de empresa, vendedores ativos, bloqueio transacional e round-robin por `row_number()`.
- [ ] **Step 2: Run test to verify it fails:** `pnpm test src/lib/lead-redistribution-contract.test.ts`; esperado: migration ausente.
- [ ] **Step 3: Create the SQL function** com `auth.uid()`, validação do perfil, `pg_advisory_xact_lock`, rejeição de IDs fora da empresa, vendedores obtidos de `VENDEDORES` unidos a `profiles`, atualização por CTE e retorno dos pares atualizados; revogar acesso público e conceder apenas a `authenticated`.
- [ ] **Step 4: Run test to verify it passes:** `pnpm test src/lib/lead-redistribution-contract.test.ts`; esperado: PASS.

### Task 3: Seleção e ação de redistribuição na aba Leads

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(app)/leads/page.tsx`
- Create: `src/components/RedistributeLeadsDialog.tsx`
- Create: `src/lib/leads-page-redistribution.test.ts`

**Interfaces:**
- Consumes: RPC `redistribuir_leads`.
- Produces: checkboxes por linha, checkbox mestre dos resultados filtrados, contador, botão “Redistribuir” e diálogo de confirmação/resultado.

- [ ] **Step 1: Write the failing UI contract tests** para seleção individual, seleção de todos os filtrados, preservação da seleção ao mudar filtro, permissão por papel e envio exato dos IDs selecionados.
- [ ] **Step 2: Run test to verify it fails:** `pnpm test src/lib/leads-page-redistribution.test.ts`; esperado: controles ausentes.
- [ ] **Step 3: Pass `userCargo` into the page context/component boundary** e exibir a ação somente para gestores.
- [ ] **Step 4: Implement selection with `Set<number>`**, incluindo estado `indeterminate`; impedir o clique do checkbox de abrir o drawer.
- [ ] **Step 5: Implement the confirmation dialog** mostrando quantidade de leads e vendedores ativos previstos, chamar a RPC uma vez e atualizar o estado local pelos pares retornados.
- [ ] **Step 6: Add loading, success and error feedback**, limpar seleção somente após sucesso e disparar `lead-assignments-changed`.
- [ ] **Step 7: Run focused and full tests:** `pnpm test src/lib/leads-page-redistribution.test.ts` e `pnpm test`; esperado: todos PASS.

### Task 4: Núcleo do modo escuro sem flash

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/lib/theme.ts`
- Create: `src/lib/theme.test.ts`
- Create: `src/components/ThemeToggle.tsx`
- Modify: `src/components/Sidebar.tsx`

**Interfaces:**
- Produces: `getStoredTheme`, `getPreferredTheme`, `applyTheme`, `setTheme`, `NO_FLASH_THEME_SCRIPT` e botão de alternância.

- [ ] **Step 1: Write failing tests** para preferência salva, fallback do sistema, aplicação da classe e script preventivo.
- [ ] **Step 2: Run test to verify it fails:** `pnpm test src/lib/theme.test.ts`; esperado: módulo ausente.
- [ ] **Step 3: Port the theme helper and toggle from AUTOJANSCAR**, trocando a chave para `jotap-theme`.
- [ ] **Step 4: Enable `darkMode: 'class'` and active CSS tokens** (`background`, `foreground`, `primary`, `secondary`, `card`) sem sobrescrever o branding persistido.
- [ ] **Step 5: Inject `NO_FLASH_THEME_SCRIPT` in the root `<head>`** e usar `suppressHydrationWarning`.
- [ ] **Step 6: Add the toggle to Sidebar’s user menu** com rótulos acessíveis “Modo escuro/Modo claro”.
- [ ] **Step 7: Run focused test:** `pnpm test src/lib/theme.test.ts`; esperado: PASS.

### Task 5: Cobertura visual escura de todas as telas atuais

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/leads/page.tsx`
- Modify: `src/app/(app)/pipeline/page.tsx`
- Modify: `src/app/(app)/estoque/page.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/Avatar.tsx`
- Modify: `src/components/AutomotiveLoading.tsx`
- Modify: `src/components/CustomDateRangePicker.tsx`
- Modify: `src/components/KpiCard.tsx`
- Modify: `src/components/LeadDrawer.tsx`
- Modify: `src/components/LeadFiltersBar.tsx`
- Modify: `src/components/NovoLeadModal.tsx`
- Modify: `src/components/PillFilter.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/StatusBadge.tsx`

**Interfaces:**
- Consumes: Tailwind `dark:` variants and active theme tokens.

- [ ] **Step 1: Inventory hard-coded light surfaces** with `rg -n "bg-white|bg-gray-50|text-gray-|border-gray-" src` and record every rendered component.
- [ ] **Step 2: Port only the matching dark variants from AUTOJANSCAR** for shared files, reviewing divergent JOTAP-only markup manually.
- [ ] **Step 3: Add dark variants to remaining JOTAP-only surfaces**, including hover, disabled, modal overlay, input, select, table and scrollbar-adjacent backgrounds.
- [ ] **Step 4: Run `pnpm test` and `pnpm build`;** expected: all tests PASS and production build succeeds.
- [ ] **Step 5: Start `pnpm dev` and manually verify** login, Leads (including dialog), Pipeline, Dashboard, Estoque and Configurações in both themes, at desktop and narrow viewport; expected: readable contrast and no light flash on reload.

### Task 6: Documentation and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document migration application** (`supabase db push` or execution through Supabase SQL Editor) and the user workflow for filtering, selecting, confirming and undoing manually.
- [ ] **Step 2: Document theme behavior** (local browser preference and system fallback).
- [ ] **Step 3: Run `git diff --check`, `pnpm test`, and `pnpm build`;** expected: no whitespace errors, all tests pass, build succeeds.

