-- EazyClick CRM — migração inicial
--
-- IMPORTANTE: as tabelas BASE_DE_LEADS, VENDEDORES, ESTOQUE, AGENDAMENTOS, HISTORICO_VISITAS,
-- HISTORICO_CHAT e "AUTORIZAÇÃO" já existem no banco (criadas por outro fluxo/automação) e NÃO
-- são recriadas aqui. Esta migração cuida apenas da camada de autenticação/autorização e das
-- tabelas de suporte do próprio CRM (profiles, app_settings, etiquetas).

-- =========================================================================
-- profiles
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  cargo text not null default 'vendedor' check (cargo in ('admin_master', 'gerente', 'vendedor')),
  created_at timestamptz default now()
);

-- Function auxiliar de RLS: retorna o cargo do usuário logado.
-- É SECURITY DEFINER para poder ler a tabela profiles sem disparar novamente as policies de
-- profiles (evitando recursão infinita: a policy de profiles chamaria get_my_cargo(), que por
-- sua vez consultaria profiles, que aplicaria a policy de novo, e assim por diante).
create or replace function public.get_my_cargo()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select cargo from public.profiles where id = auth.uid();
$$;

-- Trigger: cria automaticamente um registro em profiles (e, se vendedor, também em VENDEDORES)
-- sempre que um novo usuário é criado em auth.users.
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
    insert into public."VENDEDORES" (vendedor, telefone, id_empresa, quantos_lead)
    values (
      new.raw_user_meta_data->>'nome',
      new.raw_user_meta_data->>'telefone',
      null,
      0
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- app_settings (linha única de configuração, ex: token da uazapi)
-- =========================================================================
create table if not exists public.app_settings (
  id int primary key default 1,
  uazapi_token text,
  uazapi_base_url text not null default 'https://eazytech.uazapi.com',
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into public.app_settings (id, uazapi_base_url)
values (1, 'https://eazytech.uazapi.com')
on conflict (id) do nothing;

-- =========================================================================
-- etiquetas
-- =========================================================================
create table if not exists public.etiquetas (
  id bigserial primary key,
  nome text not null,
  cor text not null default '#888888',
  created_at timestamptz default now()
);

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.etiquetas enable row level security;

-- profiles: qualquer usuário autenticado pode listar todos os perfis (necessário para telas
-- como "Leads por Vendedor", seleção de vendedor em formulários, fila de atendimento etc).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- profiles: update permitido no próprio registro, OU por quem tem cargo admin_master/gerente.
drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or public.get_my_cargo() in ('admin_master', 'gerente')
  );

-- app_settings: select/update restritos a admin_master.
drop policy if exists "app_settings_select_admin" on public.app_settings;
create policy "app_settings_select_admin"
  on public.app_settings for select
  to authenticated
  using (public.get_my_cargo() = 'admin_master');

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin"
  on public.app_settings for update
  to authenticated
  using (public.get_my_cargo() = 'admin_master');

-- etiquetas: select para todos autenticados, escrita restrita a admin_master/gerente.
drop policy if exists "etiquetas_select_authenticated" on public.etiquetas;
create policy "etiquetas_select_authenticated"
  on public.etiquetas for select
  to authenticated
  using (true);

drop policy if exists "etiquetas_insert_admin_gerente" on public.etiquetas;
create policy "etiquetas_insert_admin_gerente"
  on public.etiquetas for insert
  to authenticated
  with check (public.get_my_cargo() in ('admin_master', 'gerente'));

drop policy if exists "etiquetas_update_admin_gerente" on public.etiquetas;
create policy "etiquetas_update_admin_gerente"
  on public.etiquetas for update
  to authenticated
  using (public.get_my_cargo() in ('admin_master', 'gerente'));

drop policy if exists "etiquetas_delete_admin_gerente" on public.etiquetas;
create policy "etiquetas_delete_admin_gerente"
  on public.etiquetas for delete
  to authenticated
  using (public.get_my_cargo() in ('admin_master', 'gerente'));
