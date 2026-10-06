-- Correção de segurança pós-0011: remove policies permissivas legadas e impede escalação de cargo.

create or replace function public.get_my_cargo() returns text
language sql security definer stable set search_path = public
as $$ select cargo from public.profiles where id = auth.uid() and desativado = false $$;

create or replace function public.get_my_nome() returns text
language sql security definer stable set search_path = public
as $$ select nome from public.profiles where id = auth.uid() and desativado = false $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_cargo text := coalesce(new.raw_app_meta_data->>'cargo', 'vendedor');
declare v_nome text := new.raw_user_meta_data->>'nome';
begin
  if v_cargo not in ('admin_master', 'admin', 'gerente', 'vendedor') then
    v_cargo := 'vendedor';
  end if;
  insert into public.profiles (id, nome, email, cargo)
  values (new.id, v_nome, new.email, v_cargo)
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, cargo = excluded.cargo;
  return new;
end $$;

create or replace function public.protect_admin_master_role() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.cargo = 'admin_master'
     and old.cargo is distinct from 'admin_master'
     and coalesce(public.get_my_cargo(), '') <> 'admin_master' then
    raise exception 'Somente admin_master pode atribuir o cargo admin_master.';
  end if;
  return new;
end $$;

drop trigger if exists protect_admin_master_role on public.profiles;
create trigger protect_admin_master_role before update of cargo on public.profiles
for each row execute function public.protect_admin_master_role();

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
drop policy if exists "jotap_profiles_update" on public.profiles;
create policy "jotap_profiles_update" on public.profiles for update to authenticated
using (public.get_my_cargo() in ('admin_master','admin','gerente'))
with check (
  public.get_my_cargo() in ('admin_master','admin','gerente')
  and (cargo <> 'admin_master' or public.get_my_cargo() = 'admin_master')
);

drop policy if exists "lead_etiquetas_all_authenticated" on public.lead_etiquetas;
drop policy if exists "lead_historico_estagio_all_authenticated" on public.lead_historico_estagio;
drop policy if exists "jotap_lead_etiquetas_all" on public.lead_etiquetas;
create policy "jotap_lead_etiquetas_all" on public.lead_etiquetas for all to authenticated
using (exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead))
with check (exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead));
drop policy if exists "jotap_historico_all" on public.lead_historico_estagio;
create policy "jotap_historico_all" on public.lead_historico_estagio for all to authenticated
using (exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead))
with check (exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead));

drop policy if exists "logos_public_read" on storage.objects;
drop policy if exists "logos_admin_master_insert" on storage.objects;
drop policy if exists "logos_admin_master_update" on storage.objects;
drop policy if exists "logos_admin_master_delete" on storage.objects;
drop policy if exists "jotap_logos_admin_delete" on storage.objects;
create policy "jotap_logos_admin_delete" on storage.objects for delete to authenticated
using (bucket_id = 'logos' and public.get_my_cargo() = 'admin_master');

notify pgrst, 'reload schema';
