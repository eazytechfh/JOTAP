-- EazyClick CRM — ajustes de cargos e regras de acesso por vendedor.
--
-- 1) Nova role "admin" (administrador do sistema, acesso total de visualização), distinta de
--    "admin_master" (role oculta, senha padrão interna dos desenvolvedores, nunca criável pela UI).
-- 2) Todo vendedor criado pelo sistema entra automaticamente na fila de atendimento como "espera".
-- 3) RLS de BASE_DE_LEADS: admin_master/admin/gerente veem todos os leads; vendedor só vê os
--    leads cuja coluna "vendedor" (texto) é igual ao seu próprio nome em profiles.

alter table public.profiles drop constraint if exists profiles_cargo_check;
alter table public.profiles
  add constraint profiles_cargo_check
  check (cargo in ('admin_master', 'admin', 'gerente', 'vendedor'));

create or replace function public.get_my_nome()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select nome from public.profiles where id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cargo text;
begin
  v_cargo := coalesce(new.raw_user_meta_data->>'cargo', 'vendedor');

  insert into public.profiles (id, nome, email, cargo)
  values (
    new.id,
    new.raw_user_meta_data->>'nome',
    new.email,
    v_cargo
  );

  if v_cargo = 'vendedor' then
    insert into public."VENDEDORES" (vendedor, telefone, id_empresa, quantos_lead, atender)
    values (
      new.raw_user_meta_data->>'nome',
      new.raw_user_meta_data->>'telefone',
      null,
      0,
      'espera'
    );
  end if;

  return new;
end;
$$;

drop policy if exists "base_de_leads_all_authenticated" on public."BASE_DE_LEADS";

drop policy if exists "base_de_leads_select" on public."BASE_DE_LEADS";
create policy "base_de_leads_select"
  on public."BASE_DE_LEADS" for select
  to authenticated
  using (
    public.get_my_cargo() in ('admin_master', 'admin', 'gerente')
    or vendedor = public.get_my_nome()
  );

drop policy if exists "base_de_leads_insert" on public."BASE_DE_LEADS";
create policy "base_de_leads_insert"
  on public."BASE_DE_LEADS" for insert
  to authenticated
  with check (true);

drop policy if exists "base_de_leads_update" on public."BASE_DE_LEADS";
create policy "base_de_leads_update"
  on public."BASE_DE_LEADS" for update
  to authenticated
  using (
    public.get_my_cargo() in ('admin_master', 'admin', 'gerente')
    or vendedor = public.get_my_nome()
  )
  with check (
    public.get_my_cargo() in ('admin_master', 'admin', 'gerente')
    or vendedor = public.get_my_nome()
  );

drop policy if exists "base_de_leads_delete" on public."BASE_DE_LEADS";
create policy "base_de_leads_delete"
  on public."BASE_DE_LEADS" for delete
  to authenticated
  using (public.get_my_cargo() in ('admin_master', 'admin', 'gerente'));
