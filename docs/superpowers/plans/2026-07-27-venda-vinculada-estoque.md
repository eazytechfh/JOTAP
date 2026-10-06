# Venda vinculada ao estoque Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exigir um veículo disponível no fechamento e marcar esse veículo como vendido atomicamente.

**Architecture:** O modal do Pipeline consulta `public.estoque` e oferece um combobox pesquisável que abre para baixo. Uma RPC protegida trava o lead e o veículo, revalida autorização e disponibilidade e atualiza ambos na mesma transação.

**Tech Stack:** Next.js 14, React, TypeScript, Supabase/PostgreSQL, Vitest e Tailwind CSS.

## Global Constraints

- Preservar as alterações preexistentes do prompt universal.
- Não executar migrations no banco ativo.
- Usar a tabela real minúscula `public.estoque`.
- Criar uma migration aditiva `0016`; não editar migrations já aplicadas.

---

### Task 1: Contrato automatizado

**Files:**
- Modify: `src/lib/crm-automotivo.test.ts`
- Test: `src/lib/crm-automotivo.test.ts`

**Interfaces:**
- Consumes: leitura de arquivos pelo helper `read(path)`.
- Produces: contrato para combobox e RPC `fechar_venda_com_veiculo`.

- [ ] Adicionar asserções para busca digitável, `top-full`, tabela `estoque`, RPC, `FOR UPDATE` e status vendido.
- [ ] Executar `npm test -- --run src/lib/crm-automotivo.test.ts` e confirmar falha pela ausência da migration.

### Task 2: Modal e transação

**Files:**
- Modify: `src/app/(app)/pipeline/page.tsx`
- Create: `supabase/migrations/0016_venda_vinculada_estoque.sql`

**Interfaces:**
- Consumes: `onConfirm(nome: string, valor: number, veiculoId: number): Promise<boolean>`.
- Produces: RPC `fechar_venda_com_veiculo(bigint,text,numeric,text)`.

- [ ] Carregar `id, marca, modelo, ano, placa, status` de `estoque`.
- [ ] Filtrar somente status normalizado `disponivel`.
- [ ] Renderizar combobox com placeholder `Digite marca, modelo, ano ou placa`, lista `top-full`, `max-h-60` e scroll.
- [ ] Abrir o modal em toda tentativa de mover para `fechado`.
- [ ] Chamar a RPC e só atualizar UI, histórico e celebração depois do sucesso.
- [ ] Na migration, adicionar `estoque_veiculo_id`, reforçar o trigger, travar lead/veículo e atualizar ambos atomicamente.
- [ ] Revogar a RPC de `PUBLIC`/`anon` e conceder a `authenticated`.

### Task 3: Documentação e validação

**Files:**
- Modify: `docs/PROMPT-UNIVERSAL-CRM-AUTOMOTIVO-GPT-5.6-SOL.md`

**Interfaces:**
- Consumes: implementação concluída.
- Produces: seção reutilizável com prevenção de concorrência, tabela real e critérios de aceite.

- [ ] Acrescentar a implementação ao prompt sem apagar o conteúdo preexistente.
- [ ] Executar teste focado, suíte completa, `npx tsc --noEmit`, `npm run build` e `git diff --check`.
