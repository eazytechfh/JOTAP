# Desativação e Exclusão de Usuários Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover vendedores desativados da fila e permitir que gestores excluam integralmente um usuário.

**Architecture:** Uma migration fornece uma função transacional para sincronizar `profiles.desativado` com `VENDEDORES.ativo/atender` por nome normalizado. Um trigger `BEFORE DELETE` em `auth.users` limpa `VENDEDORES` e `public.usuarios`; o `ON DELETE CASCADE` existente remove `profiles`. A API mantém autenticação e RBAC no servidor, e a interface mostra confirmação explícita antes da exclusão.

**Tech Stack:** Next.js 14, TypeScript, Supabase Auth/Postgres, React, Vitest.

## Global Constraints

- Admin master, admin e gerente podem gerenciar usuários.
- O usuário autenticado não pode desativar nem excluir a própria conta.
- `admin_master` não pode ser desativado ou excluído pela interface/API.
- A service role permanece exclusivamente em código de servidor.

---

### Task 1: Contratos de banco e fila

**Files:**
- Create: `src/lib/user-lifecycle.test.ts`
- Create: `supabase/migrations/0023_user_lifecycle.sql`
- Modify: `src/app/api/users/[id]/ban/route.ts`
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Modify: `src/types/database.ts`

**Interfaces:**
- Consumes: `profiles(id, nome, email, cargo, desativado)` e `VENDEDORES(vendedor, ativo, atender)`.
- Produces: RPC `public.set_user_disabled(p_user_id uuid, p_disabled boolean)` e listagem da fila limitada a `ativo = true`.

- [ ] **Step 1: Write the failing test**

Criar testes que exijam comparação `lower(trim(...))`, atualização conjunta de perfil/vendedor e filtro `.eq('ativo', true)` na fila.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/user-lifecycle.test.ts`
Expected: FAIL porque a migration 0023 e os novos contratos ainda não existem.

- [ ] **Step 3: Write minimal implementation**

Criar a RPC transacional, trocar os updates separados da rota de ban por `admin.rpc('set_user_disabled', ...)`, selecionar `ativo` e aplicar `.eq('ativo', true)` na fila.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/user-lifecycle.test.ts`
Expected: PASS.

### Task 2: Exclusão integral protegida

**Files:**
- Modify: `src/lib/user-lifecycle.test.ts`
- Modify: `supabase/migrations/0023_user_lifecycle.sql`
- Create: `src/app/api/users/[id]/route.ts`
- Modify: `src/app/(app)/configuracoes/page.tsx`

**Interfaces:**
- Consumes: `admin.auth.admin.deleteUser(id)` e o perfil-alvo.
- Produces: `DELETE /api/users/:id`, trigger `public.cleanup_deleted_auth_user()` e botão `Excluir` com confirmação.

- [ ] **Step 1: Write the failing test**

Exigir que o trigger apague `VENDEDORES` por nome normalizado e `public.usuarios` por e-mail antes da remoção de `auth.users`, além de RBAC, bloqueio de autoexclusão/admin master e chamada de `deleteUser` na API.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/user-lifecycle.test.ts`
Expected: FAIL porque rota, trigger e interface ainda não existem.

- [ ] **Step 3: Write minimal implementation**

Implementar o trigger atômico, a rota DELETE server-side e o botão ao lado de Desativar. Após sucesso, remover o perfil do estado local.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/user-lifecycle.test.ts`
Expected: PASS.

### Task 3: Verificação final

**Files:**
- Test: `src/lib/user-lifecycle.test.ts`

**Interfaces:**
- Consumes: toda a implementação das tarefas anteriores.
- Produces: evidência de regressão, tipagem e build válidos.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: todos os testes PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build concluído sem erros de TypeScript ou Next.js.

- [ ] **Step 3: Review security boundaries**

Confirmar que a rota exige sessão, aplica `canManageUsers`, bloqueia o próprio ID e `admin_master`, e que nenhum segredo foi importado pelo componente cliente.
