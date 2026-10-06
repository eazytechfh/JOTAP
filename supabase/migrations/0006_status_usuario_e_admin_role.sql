-- EazyClick CRM — status de ativação do usuário e inclusão da role "admin" nas policies de
-- profiles (a role foi criada na migration anterior, mas a policy de update ainda só liberava
-- admin_master/gerente, impedindo um "admin" de alterar cargo de outros usuários).

alter table public.profiles
  add column if not exists desativado boolean not null default false;

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or public.get_my_cargo() in ('admin_master', 'admin', 'gerente')
  );
