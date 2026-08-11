# Filtro de Período Personalizado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário filtre Visão Geral, Leads e Pipeline por um intervalo inclusivo de datas escolhido manualmente.

**Architecture:** A regra de datas ficará em `lead-period-filter.ts`, com interpretação local de `YYYY-MM-DD` para evitar deslocamento de fuso. Leads e Pipeline continuarão compartilhando `useLeadFilters`/`LeadFiltersBar`; a Visão Geral consumirá a mesma regra de limites e manterá a comparação com o período anterior de igual duração.

**Tech Stack:** React, TypeScript, Next.js 14, date-fns, Vitest.

## Global Constraints

- Preservar os atalhos Hoje, Ontem, 7 dias, 30 dias, 90 dias e Todos onde já existem.
- O início deve ser inclusivo às 00:00:00.000 e o fim inclusivo às 23:59:59.999 no fuso local.
- Intervalos incompletos ou invertidos não podem produzir resultados incorretos.
- A Visão Geral deve comparar o intervalo personalizado com o intervalo imediatamente anterior de igual duração.

---

### Task 1: Regra de intervalo personalizado

**Files:**
- Modify: `src/lib/lead-period-filter.ts`
- Test: `src/lib/lead-period-filter.test.ts`

**Interfaces:**
- Produces: `Periodo` com `personalizado`, `CustomDateRange`, `getCustomDateBoundaries()` e suporte opcional em `isLeadWithinPeriod()`.

- [ ] **Step 1: Write the failing tests** para limites inclusivos, datas fora do intervalo e intervalo inválido.
- [ ] **Step 2: Run** `npm test -- src/lib/lead-period-filter.test.ts` e confirmar falha pela API ausente.
- [ ] **Step 3: Implement** parsing local e filtragem inclusiva sem alterar os atalhos existentes.
- [ ] **Step 4: Run** o teste focal e confirmar PASS.

### Task 2: Leads e Pipeline

**Files:**
- Create: `src/components/CustomDateRangePicker.tsx`
- Modify: `src/hooks/useLeadFilters.ts`
- Modify: `src/components/LeadFiltersBar.tsx`
- Test: `src/lib/custom-period-ui.test.ts`

**Interfaces:**
- Consumes: `CustomDateRange` e `isLeadWithinPeriod()`.
- Produces: estados `customDateRange`, `setCustomStart`, `setCustomEnd` e campos de data visíveis quando `periodo === 'personalizado'`.

- [ ] **Step 1: Write the failing contract test** exigindo a opção, os dois campos e o intervalo passado ao filtro.
- [ ] **Step 2: Run** `npm test -- src/lib/custom-period-ui.test.ts` e confirmar FAIL.
- [ ] **Step 3: Implement** estados, seletor reutilizável e limpeza dos filtros.
- [ ] **Step 4: Run** os testes focais e confirmar PASS.

### Task 3: Visão Geral e verificação

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/lib/custom-period-ui.test.ts`

**Interfaces:**
- Consumes: `CustomDateRangePicker` e `getCustomDateBoundaries()`.
- Produces: opção `Personalizado`, intervalo atual e período anterior de igual número de dias.

- [ ] **Step 1: Extend the failing test** para exigir o seletor e o cálculo comparativo no dashboard.
- [ ] **Step 2: Run** o teste e confirmar FAIL.
- [ ] **Step 3: Implement** o novo caso em `getPeriodoRange()` e renderizar o seletor.
- [ ] **Step 4: Run** `npm test` e `npm run build`, esperando todos os testes e o build aprovados.
