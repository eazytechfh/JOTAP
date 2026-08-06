# Restaurar Fila de Novo Vendedor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que todo novo usuário com cargo `vendedor` tenha uma linha operacional em `VENDEDORES` sem alterar a vez, a ordem ou os contadores da automação de distribuição.

**Architecture:** Uma nova migração idempotente substituirá `handle_new_user()` preservando o endurecimento de cargo da migração `0012` e restaurando o vínculo operacional da `0011`. A migração reutilizará linhas existentes por nome normalizado, criará somente linhas ausentes com status `espera` e reconciliará vendedores ativos já órfãos sem tocar em `atender` ou `quantos_lead` existentes.

**Tech Stack:** PostgreSQL/PLpgSQL, Supabase Auth triggers, Vitest.

## Global Constraints

- Vendedor novo nunca pode assumir automaticamente o status `vez`.
- Linhas existentes em `VENDEDORES` não podem ter `atender` nem `quantos_lead` alterados.
- O cargo deve continuar vindo de `raw_app_meta_data` e ser validado pela lista permitida.
- A migração deve ser idempotente e segura para bancos com ou sem vendedores órfãos.

---

### Task 1: Contrato de regressão da fila

**Files:**
- Create: `src/lib/seller-queue-trigger.test.ts`
- Test: `src/lib/seller-queue-trigger.test.ts`

**Interfaces:**
- Consumes: arquivo SQL `supabase/migrations/0022_restore_new_seller_queue.sql`.
- Produces: contrato automatizado para as invariantes do trigger e do backfill.

- [x] **Step 1: Write the failing test**

Criar testes que leiam a migração e exijam: cargo de `raw_app_meta_data`; reutilização por nome normalizado; inserção ausente como `espera`, `0`, `true`; ausência de alterações de `atender` e `quantos_lead` no bloco de atualização; backfill apenas de perfis vendedores ativos e ausentes.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/seller-queue-trigger.test.ts`

Expected: FAIL porque `0022_restore_new_seller_queue.sql` ainda não existe.

- [x] **Step 3: Write minimal implementation**

Criar `0022_restore_new_seller_queue.sql` com `create or replace function public.handle_new_user()`, validação de cargo, upsert de `profiles`, atualização não destrutiva da linha operacional e inserção em espera somente quando ausente. Acrescentar backfill idempotente por `not exists`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/seller-queue-trigger.test.ts`

Expected: PASS.

### Task 2: Verificação global

**Files:**
- Verify: `src/lib/seller-queue-trigger.test.ts`
- Verify: `supabase/migrations/0022_restore_new_seller_queue.sql`

**Interfaces:**
- Consumes: migração e contrato concluídos na Task 1.
- Produces: evidência de compatibilidade com o restante do projeto.

- [x] **Step 1: Run all automated tests**

Run: `npm test`

Expected: todos os testes passam.

- [x] **Step 2: Run the production build**

Run: `npm run build`

Expected: build concluído sem erros.

- [x] **Step 3: Inspect the final diff**

Run: `git diff --check` e `git diff --stat`

Expected: nenhuma falha de whitespace e somente plano, teste e migração relacionados à correção.
