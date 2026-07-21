-- JOTAP: camada CRM idempotente sobre tabelas operacionais existentes.
-- Não recria BASE_DE_LEADS, VENDEDORES ou estoque e não altera dados operacionais em massa.

alter table public."BASE_DE_LEADS"
  add column if not exists cpf varchar,
  add column if not exists data_nascimento date,
  add column if not exists score_serasa integer,
  add column if not exists follow_manual text not null default 'inativo',
  add column if not exists negociacao_expira_em timestamptz,
  add column if not exists negociacao_notificado_em timestamptz,
  add column if not exists negociacao_extensoes integer not null default 0;

alter table public."VENDEDORES"
  add column if not exists ativo boolean not null default true;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  cargo text not null default 'vendedor'
    check (cargo in ('admin_master', 'admin', 'gerente', 'vendedor')),
  desativado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pipeline_etapas (
  id text primary key,
  nome text not null,
  ordem integer not null,
  cor text not null default '#6b7280',
  ativa boolean not null default true
);

insert into public.pipeline_etapas (id, nome, ordem, cor) values
  ('oportunidade', 'Oportunidade', 10, '#22c55e'),
  ('em_qualificacao', 'Em qualificação', 20, '#3b82f6'),
  ('em_negociacao', 'Em negociação', 30, '#f59e0b'),
  ('follow_up', 'Follow-up', 40, '#8b5cf6'),
  ('nao_fechou', 'Não fechou', 50, '#ef4444'),
  ('transferidos', 'Transferidos', 60, '#6b7280')
on conflict (id) do nothing;

create table if not exists public.app_settings (
  id integer primary key default 1 check (id = 1),
  uazapi_token text,
  uazapi_base_url text not null default 'https://eazytech.uazapi.com',
  logo_url text,
  cor_primaria text not null default '#b91c1c',
  cor_secundaria text not null default '#2563eb',
  cor_texto text not null default '#111827',
  cor_fundo text not null default '#f5f6f8',
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.etiquetas (
  id bigserial primary key,
  nome text not null,
  cor text not null default '#888888',
  created_at timestamptz not null default now()
);

create table if not exists public.lead_etiquetas (
  id bigserial primary key,
  id_lead bigint not null,
  id_etiqueta bigint not null references public.etiquetas(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id_lead, id_etiqueta)
);

create table if not exists public.lead_historico_estagio (
  id bigserial primary key,
  id_lead bigint not null,
  estagio_anterior text,
  estagio_novo text not null,
  usuario text,
  created_at timestamptz not null default now()
);

create or replace function public.get_my_cargo() returns text
language sql security definer stable set search_path = public
as $$ select cargo from public.profiles where id = auth.uid() $$;

create or replace function public.get_my_nome() returns text
language sql security definer stable set search_path = public
as $$ select nome from public.profiles where id = auth.uid() $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_cargo text := coalesce(new.raw_user_meta_data->>'cargo', 'vendedor');
declare v_nome text := new.raw_user_meta_data->>'nome';
begin
  insert into public.profiles (id, nome, email, cargo)
  values (new.id, v_nome, new.email, v_cargo)
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, cargo = excluded.cargo;

  if v_cargo = 'vendedor' then
    update public."VENDEDORES"
       set telefone = coalesce(telefone, new.raw_user_meta_data->>'telefone'), ativo = true
     where lower(trim(vendedor)) = lower(trim(v_nome));
    if not found then
      insert into public."VENDEDORES" (vendedor, telefone, atender, quantos_lead, ativo)
      values (v_nome, new.raw_user_meta_data->>'telefone', 'espera', 0, true);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public."BASE_DE_LEADS" enable row level security;
alter table public."VENDEDORES" enable row level security;
alter table public.estoque enable row level security;
alter table public.profiles enable row level security;
alter table public.pipeline_etapas enable row level security;
alter table public.app_settings enable row level security;
alter table public.etiquetas enable row level security;
alter table public.lead_etiquetas enable row level security;
alter table public.lead_historico_estagio enable row level security;

drop policy if exists "jotap_leads_select" on public."BASE_DE_LEADS";
drop policy if exists "base_de_leads_all_authenticated" on public."BASE_DE_LEADS";
drop policy if exists "base_de_leads_select" on public."BASE_DE_LEADS";
drop policy if exists "base_de_leads_insert" on public."BASE_DE_LEADS";
drop policy if exists "base_de_leads_update" on public."BASE_DE_LEADS";
drop policy if exists "base_de_leads_delete" on public."BASE_DE_LEADS";
create policy "jotap_leads_select" on public."BASE_DE_LEADS" for select to authenticated
using (public.get_my_cargo() in ('admin_master','admin','gerente') or lower(trim(vendedor)) = lower(trim(public.get_my_nome())));
drop policy if exists "jotap_leads_insert" on public."BASE_DE_LEADS";
create policy "jotap_leads_insert" on public."BASE_DE_LEADS" for insert to authenticated
with check (public.get_my_cargo() in ('admin_master','admin','gerente') or lower(trim(vendedor)) = lower(trim(public.get_my_nome())));
drop policy if exists "jotap_leads_update" on public."BASE_DE_LEADS";
create policy "jotap_leads_update" on public."BASE_DE_LEADS" for update to authenticated
using (public.get_my_cargo() in ('admin_master','admin','gerente') or lower(trim(vendedor)) = lower(trim(public.get_my_nome())))
with check (public.get_my_cargo() in ('admin_master','admin','gerente') or lower(trim(vendedor)) = lower(trim(public.get_my_nome())));

drop policy if exists "jotap_vendedores_select" on public."VENDEDORES";
drop policy if exists "vendedores_all_authenticated" on public."VENDEDORES";
create policy "jotap_vendedores_select" on public."VENDEDORES" for select to authenticated using (true);
drop policy if exists "jotap_vendedores_write" on public."VENDEDORES";
create policy "jotap_vendedores_write" on public."VENDEDORES" for all to authenticated
using (public.get_my_cargo() in ('admin_master','admin','gerente'))
with check (public.get_my_cargo() in ('admin_master','admin','gerente'));

drop policy if exists "jotap_estoque_select" on public.estoque;
drop policy if exists "estoque_all_authenticated" on public.estoque;
create policy "jotap_estoque_select" on public.estoque for select to authenticated using (true);

drop policy if exists "jotap_profiles_select" on public.profiles;
create policy "jotap_profiles_select" on public.profiles for select to authenticated using (true);
drop policy if exists "jotap_profiles_update" on public.profiles;
create policy "jotap_profiles_update" on public.profiles for update to authenticated
using (id = auth.uid() or public.get_my_cargo() in ('admin_master','admin','gerente'));

drop policy if exists "jotap_pipeline_select" on public.pipeline_etapas;
create policy "jotap_pipeline_select" on public.pipeline_etapas for select to authenticated using (true);
drop policy if exists "jotap_pipeline_write" on public.pipeline_etapas;
create policy "jotap_pipeline_write" on public.pipeline_etapas for all to authenticated
using (public.get_my_cargo() in ('admin_master','admin','gerente'))
with check (public.get_my_cargo() in ('admin_master','admin','gerente'));

drop policy if exists "jotap_support_read" on public.etiquetas;
create policy "jotap_support_read" on public.etiquetas for select to authenticated using (true);
drop policy if exists "jotap_etiquetas_write" on public.etiquetas;
create policy "jotap_etiquetas_write" on public.etiquetas for all to authenticated
using (public.get_my_cargo() in ('admin_master','admin','gerente'))
with check (public.get_my_cargo() in ('admin_master','admin','gerente'));
drop policy if exists "jotap_lead_etiquetas_all" on public.lead_etiquetas;
create policy "jotap_lead_etiquetas_all" on public.lead_etiquetas for all to authenticated
using (exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead))
with check (exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead));
drop policy if exists "jotap_historico_all" on public.lead_historico_estagio;
create policy "jotap_historico_all" on public.lead_historico_estagio for all to authenticated
using (exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead))
with check (exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead));

drop policy if exists "jotap_settings_admin" on public.app_settings;
create policy "jotap_settings_admin" on public.app_settings for all to authenticated
using (public.get_my_cargo() = 'admin_master') with check (public.get_my_cargo() = 'admin_master');

create or replace function public.get_branding()
returns table (logo_url text, cor_primaria text, cor_secundaria text, cor_texto text, cor_fundo text)
language sql security definer stable set search_path = public
as $$ select logo_url, cor_primaria, cor_secundaria, cor_texto, cor_fundo from public.app_settings where id = 1 $$;
grant execute on function public.get_branding() to anon, authenticated;

insert into storage.buckets (id, name, public) values ('logos', 'logos', true)
on conflict (id) do update set public = true;
drop policy if exists "jotap_logos_public_read" on storage.objects;
create policy "jotap_logos_public_read" on storage.objects for select using (bucket_id = 'logos');
drop policy if exists "jotap_logos_admin_insert" on storage.objects;
create policy "jotap_logos_admin_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'logos' and public.get_my_cargo() = 'admin_master');
drop policy if exists "jotap_logos_admin_update" on storage.objects;
create policy "jotap_logos_admin_update" on storage.objects for update to authenticated
using (bucket_id = 'logos' and public.get_my_cargo() = 'admin_master');

notify pgrst, 'reload schema';
