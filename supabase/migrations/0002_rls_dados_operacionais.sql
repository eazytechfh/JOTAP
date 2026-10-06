-- EazyClick CRM — RLS para as tabelas operacionais pré-existentes (BASE_DE_LEADS, VENDEDORES,
-- ESTOQUE). Essas tabelas já existiam no banco (criadas por outro fluxo/automação) com RLS
-- habilitado e sem nenhuma policy, o que bloqueia qualquer leitura/escrita via PostgREST mesmo
-- para usuários autenticados (a query retorna vazio, sem erro). Como o CRM é single-tenant e
-- todo usuário autenticado é um funcionário interno confiável, liberamos acesso total para o
-- role "authenticated".

alter table public."BASE_DE_LEADS" enable row level security;
alter table public."VENDEDORES" enable row level security;
alter table public."ESTOQUE" enable row level security;

drop policy if exists "base_de_leads_all_authenticated" on public."BASE_DE_LEADS";
create policy "base_de_leads_all_authenticated"
  on public."BASE_DE_LEADS" for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "vendedores_all_authenticated" on public."VENDEDORES";
create policy "vendedores_all_authenticated"
  on public."VENDEDORES" for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "estoque_all_authenticated" on public."ESTOQUE";
create policy "estoque_all_authenticated"
  on public."ESTOQUE" for all
  to authenticated
  using (true)
  with check (true);
