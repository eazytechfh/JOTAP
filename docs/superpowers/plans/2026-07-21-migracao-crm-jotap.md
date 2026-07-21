# Migração CRM JOTAP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar e validar o CRM JOTAP contra o schema real do novo Supabase sem perder dados operacionais.

**Architecture:** Centralizar a leitura paginada e a deduplicação de leads em funções puras e reutilizáveis pelas três telas. Manter Auth, `profiles` e `VENDEDORES` separados, com autorização na API e no RLS, e adaptar nomes físicos somente depois da introspecção do banco.

**Tech Stack:** Next.js 14, React 18, TypeScript, Supabase JS/PostgreSQL, Vitest.

## Global Constraints

- Consultas de descoberta são somente leitura.
- Não excluir nem sobrescrever dados operacionais sem confirmação.
- Não versionar `.env.local`, chaves, senhas, tokens ou connection strings.
- Preservar layout, integrações e comportamento fora do escopo da migração.

---

### Task 1: Leitura completa e deduplicada de leads

**Files:**
- Create: `src/lib/leads.ts`
- Create: `src/lib/leads.test.ts`
- Modify: `src/app/(app)/leads/page.tsx`
- Modify: `src/app/(app)/pipeline/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `fetchAllLeads(queryFactory, select): Promise<BaseDeLeads[]>` e `deduplicateLeads(leads): { leads: BaseDeLeads[]; duplicateCount: number }`.

- [ ] Escrever testes para páginas de 1.000 registros, telefone normalizado, prefixo `55`, fallback por e-mail, fallback por `id` e preservação do registro mais recente.
- [ ] Executar `npm test -- src/lib/leads.test.ts` e confirmar falha por módulo ausente.
- [ ] Implementar lotes com `.range(inicio, fim)`, ordenação `created_at desc` e deduplicação sem mutar registros.
- [ ] Executar os testes e confirmar aprovação.
- [ ] Integrar o helper nas telas e exibir sempre `N lead(s) duplicado(s) removido(s) da exibição.`.

### Task 2: Erros legíveis e etapas legadas

**Files:**
- Create: `src/lib/supabase/error.ts`
- Create: `src/lib/supabase/error.test.ts`
- Modify: `src/app/(app)/leads/page.tsx`
- Modify: `src/app/(app)/pipeline/page.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Produces: `formatSupabaseError(error): string` e estado de erro visível nas telas.

- [ ] Testar erro vazio, coluna ausente, RLS e erro textual comum.
- [ ] Implementar formatação sem expor tokens ou objetos crus.
- [ ] Exibir falhas de consulta sem convertê-las silenciosamente em lista vazia.
- [ ] Depois de ler `pipeline_etapas`, testar e mostrar valores não configurados em “Legado”, sem `UPDATE` em massa.

### Task 3: Auth, profiles e VENDEDORES

**Files:**
- Create: `src/lib/auth/roles.ts`
- Create: `src/lib/auth/roles.test.ts`
- Modify: `src/app/api/users/create/route.ts`
- Modify: `src/app/api/users/[id]/ban/route.ts`
- Create: `supabase/migrations/0011_migracao_jotap_segura.sql`

**Interfaces:**
- Produces: `canManageUsers(cargo)` e fluxo idempotente de ativação/desativação.

- [ ] Testar a matriz `admin_master`, `admin`, `gerente`, `vendedor` e ausência de sessão.
- [ ] Após confirmar aliases físicos, fazer criação vincular vendedor existente por e-mail/nome sem zerar contagem.
- [ ] Substituir exclusão operacional por atualização de `ATIVO` e `Atender`, preservando `Quantos lead`.
- [ ] Criar SQL idempotente de RLS com vendedor restrito a `profile.nome` e administradores com visão total.
- [ ] Validar 401/403 e comparar a contagem por token de cada vendedor com a contagem administrativa filtrada.

### Task 4: Estoque, branding e validação final

**Files:**
- Modify: `src/app/(app)/estoque/page.tsx`
- Modify: `src/app/(app)/configuracoes/page.tsx`
- Modify: `src/lib/branding.ts`

**Interfaces:**
- Consumes: nomes exatos da tabela/colunas, bucket `logos` e resultado de `get_branding()` descobertos no banco.

- [ ] Reproduzir a consulta do estoque com usuário autenticado e selecionar somente colunas existentes.
- [ ] Mapear colunas com espaços por aliases e validar placeholder de imagem.
- [ ] Fazer upload do arquivo original da logo e validar HTTP 200 antes de gravar `logo_url`.
- [ ] Executar testes, `npx tsc --noEmit`, lint configurado, build e smoke tests nas seis rotas.
- [ ] Revisar segredos, `git diff --check`, status e diff antes de qualquer publicação.

### Task 5: Publicação privada

**Files:**
- Modify: somente metadados Git, depois de toda a validação.

**Interfaces:**
- Consumes: destino `OWNER/REPO`, autorização e visibilidade privada confirmados.

- [ ] Confirmar que `origin` é o destino privado correto e que `antigo` preserva o CRM original.
- [ ] Criar commit descritivo, publicar em `main` e confirmar URL, visibilidade e branch padrão.

