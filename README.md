# JOTAP — EazyClick Platform

> **Projeto em produção. Toda alteração deve ser feita com cautela máxima.**

---

## Links Importantes

| Recurso | URL |
|---|---|
| Deploy (Vercel) | https://vercel.com/eazytechfh-gmailcoms-projects/jotap |
| Repositório (GitHub) | https://github.com/eazytechfh/JOTAP |
| Conta Vercel / GitHub | eazytechfh@gmail.com |

---

## Sobre o Projeto

Plataforma CRM para gestão de leads e vendas de veículos. Permite:
- Login por empresa com controle de cargos (Administrador, Gerente, Vendedor, Convidado)
- Kanban de negociações com estágios configuráveis
- Gestão de estoque de veículos
- Dashboard com estatísticas e gráficos
- Gerenciamento de membros por empresa

**Stack:**
- **Framework:** Next.js 14 (App Router)
- **Banco de dados:** Supabase (PostgreSQL)
- **Autenticação:** Customizada via tabela `usuarios` + localStorage
- **UI:** Tailwind CSS + Radix UI + shadcn/ui
- **Deploy:** Vercel (deploy automático via push na branch principal)
- **Gerenciador de pacotes:** pnpm

---

## Estrutura do Projeto

```
/
├── app/                        # Rotas Next.js (App Router)
│   ├── page.tsx                # Login
│   ├── layout.tsx              # Layout raiz
│   ├── dashboard/page.tsx      # Dashboard com stats e gráficos
│   ├── negociacoes/page.tsx    # Kanban de leads/negociações
│   ├── estoque/page.tsx        # Gestão de estoque de veículos
│   ├── configuracoes/page.tsx  # Perfil, membros e configurações
│   └── api/
│       ├── env-check/          # Verifica variáveis de ambiente
│       └── usuarios/[id]/      # API REST de usuários
├── components/                 # Componentes React reutilizáveis
│   ├── kanban-board.tsx        # Board drag-and-drop de negociações
│   ├── leads-list-view.tsx     # Listagem de leads
│   ├── lista-veiculos.tsx      # Lista de veículos do estoque
│   ├── dashboard-charts.tsx    # Gráficos do dashboard
│   ├── dashboard-stats.tsx     # Cards de estatísticas
│   ├── members-management.tsx  # Gerenciar membros da empresa
│   ├── login-form.tsx          # Formulário de login
│   ├── sidebar-nav.tsx         # Menu lateral
│   └── ui/                     # Componentes shadcn/ui
├── lib/                        # Lógica de negócio e acesso a dados
│   ├── auth.ts                 # Autenticação, cargos, usuários
│   ├── leads.ts                # CRUD de leads/negociações
│   ├── estoque.ts              # CRUD de estoque
│   ├── dashboard-stats.ts      # Queries de estatísticas
│   └── supabaseServer.ts       # Client Supabase para Server Components
├── utils/supabase/
│   ├── client.ts               # Client Supabase para Client Components
│   └── server.ts               # Client Supabase para Server Components
├── scripts/                    # Migrations SQL (Supabase)
│   └── 01 a 18-*.sql           # Histórico de alterações no banco
├── hooks/                      # Custom React hooks
├── styles/                     # CSS global
└── public/                     # Assets estáticos
```

---

## Banco de Dados — Tabelas Principais

| Tabela | Descrição |
|---|---|
| `usuarios` | Usuários do sistema com cargo, status e vínculo à empresa |
| `VENDEDORES` | Fila de atendimento dos vendedores por empresa |
| `leads` (ou similar) | Negociações/leads no kanban |
| `estoque` | Veículos disponíveis |

> As migrations estão em `scripts/` numeradas sequencialmente. Sempre criar um novo arquivo `.sql` numerado para qualquer alteração no banco — **nunca alterar scripts existentes**.

---

## Variáveis de Ambiente

Necessárias tanto localmente (`.env.local`) quanto no painel da Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://kqxldrdegfgwlzwszbel.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key do Supabase>
```

> `.env*` está no `.gitignore` — nunca commitar valores reais.

---

## Cargos e Permissões

| Cargo | Permissões |
|---|---|
| `administrador` | Acesso total, pode gerenciar membros, alterar cargos e status |
| `gerente` | Acesso operacional completo |
| `vendedor` | Acesso às negociações; é registrado também na tabela `VENDEDORES` |
| `convidado` | Acesso limitado |

> Ao adicionar um vendedor, ele é inserido automaticamente na tabela `VENDEDORES`. Ao inativar, o campo `atender` é atualizado para `"Inativo"`.

---

## Como Rodar Localmente

```bash
git clone https://github.com/eazytechfh/JOTAP.git
cd JOTAP
pnpm install
# Criar .env.local com as variáveis do Supabase
pnpm dev
```

---

## Deploy

- Push na branch `v0/jotapveiculosia-8406-c44af556` → Vercel faz o deploy automaticamente
- Verificar o build na Vercel antes de considerar a alteração concluída
- **Nunca fazer merge de código que não passou no build**

---

## Regras para a IA ao Fazer Qualquer Alteração

### Antes de alterar
- [ ] Ler este README completo
- [ ] Identificar todos os arquivos que dependem do que será alterado
- [ ] Verificar se há variáveis de ambiente, migrations ou tabelas envolvidas
- [ ] Nunca remover código sem certeza absoluta de que não é usado

### Durante a alteração
- [ ] Atuar como programador sênior: código limpo, tipado, sem duplicação
- [ ] Segurança: sem SQL injection, XSS, exposição de secrets ou dados sensíveis
- [ ] Alterações em rotas/APIs: manter contratos (request/response) sem quebrar clientes existentes
- [ ] Banco de dados: criar novo script SQL numerado em `scripts/` — nunca alterar scripts existentes
- [ ] Nunca dropar tabelas ou colunas sem confirmação explícita do usuário

### Após alterar
- [ ] Registrar na seção **Histórico de Alterações** abaixo
- [ ] Descrever: o que foi feito, por que, e cuidados para mudanças futuras na mesma área
- [ ] Registrar novos links, variáveis de ambiente ou dependências nas seções acima

---

## Histórico de Alterações

### 2026-06-16 — Correção do filtro de data no Kanban
- **Arquivo alterado:** `components/kanban-board.tsx`
- **Problema:** `new Date("2026-06-17")` (string YYYY-MM-DD do `<input type="date">`) é interpretado como UTC midnight. No Brasil (UTC-3), isso corresponde ao dia anterior às 21h local — `setHours(0,0,0,0)` então movia o início para meia-noite do dia errado. Efeito: "até 16/06" cortava no dia 15, e "de 17/06 até 17/06" mostrava leads de 16/06.
- **Fix:** Substituído `new Date(dateString)` por `new Date(year, month-1, day)`, que cria a data no fuso local sem ambiguidade UTC.
- **Cuidados futuros:** Em JavaScript, `new Date("YYYY-MM-DD")` **sempre** é UTC. Para datas de input tipo date, usar sempre `new Date(year, month-1, day)` (com `split("-")`). Nunca usar `new Date(string)` para comparar com timestamps locais.

### 2026-06-16 — Sprint 7: virtualização das colunas do Kanban
- **Arquivo alterado:** `components/kanban-board.tsx`; **Pacote adicionado:** `@tanstack/react-virtual`
- **Problema:** Com 750+ cards na coluna "Em Negociação", o DOM renderizava todos os cards simultaneamente — scroll lento, re-renders pesados.
- **Fix:** `useVirtualizer` do `@tanstack/react-virtual` em cada `KanbanColumn`. Apenas ~15 cards ficam no DOM por vez (os visíveis na viewport + `overscan: 5`). Cards posicionados com `position: absolute` + `translateY(virtualItem.start)`. `measureElement` mede altura real de cada card para suportar alturas variáveis.
- **Cuidados futuros:** O scroll do virtualizer depende do elemento `<CardContent>` ter `overflow-y: auto` e altura definida (flex). Se mudar o layout da coluna, verificar se o scroll ainda funciona. O `estimateSize: () => 138` é uma estimativa inicial — o `measureElement` corrige após o primeiro render.

### 2026-06-16 — Sprint 6: migração @hello-pangea/dnd → @dnd-kit
- **Arquivo alterado:** `components/kanban-board.tsx`
- **Problema raiz:** `@hello-pangea/dnd` fazia broadcast de snapshot para todas as Droppables durante qualquer drag — todas as 8 colunas e ~1000 cards re-renderizavam a cada movimento do mouse.
- **Fix:** Migrado para `@dnd-kit/core` + `@dnd-kit/utilities`. `KanbanCard` usa `useDraggable` hook. `KanbanColumn` (novo componente memo) usa `useDroppable` — só a coluna de destino re-renderiza. `DragOverlay` renderiza o preview do card fora do DOM das colunas.
- **Bônus:** Auto-scroll horizontal nativo do `DndContext` substituiu o `requestAnimationFrame` manual (removidos `kanbanViewportRef`, `dragPointerXRef`, `dragScrollFrameRef` e o useEffect inteiro).
- **Cuidados futuros:** `PointerSensor` com `activationConstraint: { distance: 8 }` evita drag acidental no clique. Se precisar de touch support, adicionar `TouchSensor` com o mesmo constraint. Virtualização agora é viável pois `@dnd-kit` tem suporte nativo.

### 2026-06-16 — Sprint 5: Supabase Realtime — fim do polling de 15s
- **Arquivo alterado:** `components/kanban-board.tsx`
- **Problema:** `setInterval` de 15s recarregava todos os ~1000 leads mesmo quando nada havia mudado, causando re-renders desnecessários.
- **Fix:** Subscription Realtime na tabela `BASE_DE_LEADS` filtrada por `id_empresa`. INSERT adiciona o lead novo ao topo. UPDATE atualiza só o lead afetado. DELETE remove do state e fecha o modal se estava aberto. Reconexão (`CHANNEL_ERROR` / `TIMED_OUT`) dispara `loadLeads()` para garantir sincronia.
- **Cuidados futuros:** Realtime exige que a tabela tenha Replication habilitada no Supabase (Table Editor → Replication). Se os eventos não chegarem, verificar essa configuração primeiro.

### 2026-06-16 — Sprint 4: moveLeadToStage com deps mínimas
- **Arquivo alterado:** `components/kanban-board.tsx`
- **Problema:** `moveLeadToStage` tinha deps `[leads, loadLeads, selectedLead]` — recriado a cada poll de 15s e a cada mudança de lead selecionado, forçando recriação em cascata de `handleKanbanDragEnd`.
- **Fix:** `setLeads(prev => ...)` agora captura `leadData` dentro do próprio callback (execução síncrona), eliminando a dep em `leads`. `setSelectedLead(prev => ...)` elimina a dep em `selectedLead`. Deps ficam `[]` — `moveLeadToStage` é criado uma única vez.
- **Cuidados futuros:** O padrão "capturar valor dentro do setState callback" funciona porque React executa o callback de forma síncrona para calcular o próximo estado. Não usar em callbacks assíncronos.

### 2026-06-16 — Sprint 3: gargalos do Drag and Drop
- **Arquivos alterados:** `components/kanban-board.tsx`
- **Fix 1 — scale-105 removido:** `transform scale-105` na coluna ao receber drag causava layout thrash de todos os cards filhos. Substituído por mudança de cor/borda apenas (`transition-colors`).
- **Fix 2 — Dead code deletado:** `handleDragEnd` e `handleAtenderLead` nunca eram chamados pelo JSX (o JSX usa `handleKanbanDragEnd` e `handleAtenderLeadAction`). Deletados sem risco.
- **Fix 3 — useCallback em handlers de DnD:** `handleDragStart` e `handleKanbanDragEnd` envolvidos em `useCallback`. Antes eram recriados a cada render, forçando re-subscribe interno do `DragDropContext`.
- **Fix 4 — draggedLead → isDragging boolean:** Estado que guardava o objeto Lead completo só era usado para verificar "está arrastando?". Substituído por `isDragging: boolean`. Menos memória, referência estável.
- **Cuidados futuros:** `@hello-pangea/dnd` tem broadcast global de snapshot — todas as Droppables re-renderizam durante qualquer drag. Se o drag continuar lento com muitos leads, considerar migração para `@dnd-kit` (notifica só a Droppable afetada).

### 2026-06-16 — Sprint 2: otimizações adicionais de performance
- **Arquivos alterados:** `lib/leads.ts`, `lib/dashboard-stats.ts`, `components/kanban-board.tsx`, `components/leads-list-view.tsx`
- **Fix A — getLeadById lazy-load:** `getLeadById` adicionado a `lib/leads.ts`. Modal de lead (Kanban e Lista) abre imediatamente com dados parciais e atualiza com dados completos (incluindo `resumo_qualificacao` e `resumo_comercial`) assim que o fetch termina — sem bloquear a UI.
- **Fix B — Removido `loadLeads()` pós-drag:** `await loadLeads()` removido do caminho de sucesso em `moveLeadToStage`. O update otimista já aplica a mudança; o fetch desnecessário causava re-render duplo.
- **Fix C — O(n²) → O(n) no dashboard:** `estagioEvolution` reconstruído com Map. Antes: 30 dias × n leads × 7 estágios = até 210k iterações. Agora: 1 passagem sobre leads + 30 lookups no Map.
- **Fix D — formatCurrency singleton + SELECT campos específicos:** `Intl.NumberFormat` instanciado uma vez em `lib/leads.ts`. `getLeads` usa `LEAD_LIST_FIELDS` (sem resumo_qualificacao/resumo_comercial), reduzindo payload do Supabase.
- **Cuidados futuros:** Se adicionar novo campo necessário no card do Kanban ou na lista, incluir em `LEAD_LIST_FIELDS`. Campos exclusivos do modal (resumo_qualificacao, resumo_comercial) são carregados via `getLeadById` — não precisam ir para a lista.

### 2026-06-16 — Implementação das otimizações de performance #1, #2, #3
- **Arquivos alterados:** `components/kanban-board.tsx`, `components/editable-value-field.tsx`, `components/editable-observacao-field.tsx`, `components/editable-veiculo-field.tsx`, `components/editable-email-field.tsx`
- **Fix #1 — Timer isolado:** Extraído componente `TransferCountdown` com `memo`. Removido `now` state e `setInterval` do `KanbanBoard`. Apenas os cards de "Transferidos" re-renderizam a cada segundo.
- **Fix #2 — Memoização:** `leadsByStage` e `stageTotals` calculados com `useMemo` — 1 forEach ao invés de 24 filtros por render. `origens` também memoizado.
- **Fix #3 — React.memo + useCallback:** Componentes `EditableValueField`, `EditableObservacaoField`, `EditableVeiculoField`, `EditableEmailField` envolvidos com `memo`. Handlers `handleValueUpdate`, `handleObservacaoUpdate`, `handleVeiculoUpdate`, `handleEmailUpdate` convertidos para `useCallback` com deps estáveis. Extraído componente `KanbanCard` com `memo` para eliminar arrow functions inline no `.map`.
- **Cuidados futuros:** Qualquer novo handler passado como prop para `KanbanCard` ou componentes editáveis DEVE ser `useCallback`. Arrow functions inline no `.map` de cards destroem o benefício do `memo`.

### 2026-06-15 — Otimização de performance do KanbanBoard
- **Arquivo alterado:** `components/kanban-board.tsx`
- **Problema:** Board travando (scroll, cliques e drag lentos) com muitos leads (132+ em Oportunidade, 91 em Transferidos, 754 em Em Negociação).
- **Causa raiz:** `setInterval` de 1 segundo chamando `setNow(Date.now())` forçava re-render de TODO o KanbanBoard a cada segundo, incluindo todos os cards. Funções `getLeadsByStage()` e `getStageTotal()` eram chamadas 3x por coluna por render sem memoização.
- **O que foi feito:**
  1. Extraído `TransferCountdown` como componente isolado com `memo` — agora só o countdown re-renderiza a cada segundo
  2. Removido `now` state e interval do `KanbanBoard`
  3. `leadsByStage` calculado com `useMemo` — recalcula só quando `filteredLeads` muda
  4. `stageTotals` calculado com `useMemo` — recalcula só quando `leadsByStage` muda
  5. `origens` convertido para `useMemo`
- **Cuidados futuros:** Qualquer lógica nova que precise atualizar a cada segundo deve ser colocada em um componente filho isolado com `memo`, nunca no `KanbanBoard` diretamente. Se adicionar novos campos calculados por estágio, adicionar ao `useMemo` de `leadsByStage`/`stageTotals`.

### 2026-06-15 — Setup inicial do README
- **O que foi feito:** README criado do zero com mapeamento completo da estrutura do projeto, stack, banco de dados, cargos, variáveis de ambiente e protocolo de alterações para a IA.
- **Cuidados futuros:** Manter este arquivo atualizado a cada alteração relevante. Registrar novos scripts SQL, variáveis de ambiente ou integrações externas assim que forem adicionados.

---

*Este README é mantido como documento vivo do projeto — atualizado a cada sessão de desenvolvimento.*
