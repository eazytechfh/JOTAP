# CRM Automotivo Jotap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar ao CRM Jotap notificações sonoras, venda validada, celebração, auditoria, estoque e loading automotivo.

**Architecture:** Supabase Realtime atualiza máquinas distintas; polling de 180 segundos serve somente como contingência. As regras críticas também ficam no PostgreSQL e a interface confirma toda persistência antes de refletir sucesso.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind, Supabase/PostgreSQL e Vitest.

## Global Constraints

- Não editar nem executar migrations existentes.
- Criar apenas `0014_crm_automotivo_auditoria_realtime.sql`.
- Preservar timers, filtros, RLS e controles de IA próprios do Jotap.
- Usar os quatro assets locais de `public/effects`.
- Celebração de 5 segundos; motor no segundo 11 e dinheiro no segundo 5.

---

### Task 1: Contratos e Realtime

- [x] Criar teste de contrato e confirmar falha inicial.
- [x] Criar watcher do vendedor com baseline, Realtime, som e fallback de 180 segundos.
- [x] Atualizar Leads e Pipeline sem refresh completo.

### Task 2: Venda e celebração

- [x] Bloquear `fechado` sem nome e valor positivo.
- [x] Exibir modal de preenchimento e persistir antes da celebração.
- [x] Reproduzir carro neon, motor e dinheiro por 5 segundos.

### Task 3: Auditoria e estoque

- [x] Mostrar autoria da observação, histórico rolável e logs gerais.
- [x] Filtrar disponíveis por padrão e permitir alternar o status confirmado no banco.
- [x] Criar migration idempotente de auditoria, validação e Realtime.

### Task 4: Validação

- [ ] Executar testes, TypeScript e build de produção.

### Task 5: Correção pós-entrega (status do estoque)

- [x] Investigar por que `atualizarStatus` falhava no Estoque: a 0011/0012 deixaram `public.estoque`
      (tabela real, minúscula) só com policy de `select`, sem `update`, então o RLS rejeitava a
      escrita silenciosamente (0 linhas afetadas) e a UI mostrava erro genérico.
- [x] Criar `0015_estoque_update_policy.sql` com policy de `update` para `authenticated`.
- [ ] Usuário precisa aplicar a `0015` no projeto Supabase ativo (SQL editor ou `supabase db push`).
- [x] Investigar por que o carro da celebração aparecia como ícone quebrado: o otimizador de
      imagem do Next faz um fetch interno servidor-a-servidor para `/effects/sale-car-neon.png`
      sem repassar o cookie de sessão; o middleware de auth interceptava esse fetch interno e
      redirecionava para `/login` (HTML), então o otimizador recebia HTML em vez de PNG e falhava.
- [x] Ajustar `matcher` de `src/middleware.ts` para excluir `effects/` (assets públicos sem dado
      sensível), corrigindo o carro sem afetar a proteção das demais rotas.
