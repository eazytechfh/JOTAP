-- EazyClick CRM — branding por cliente: logo e cores do sistema.
--
-- A tabela app_settings já guarda o token da uazapi (sensível, só admin_master pode ler/gravar).
-- Logo/cores precisam ser lidas por TODO usuário (inclusive antes do login, na tela de login),
-- então em vez de abrir o SELECT de app_settings para todo mundo (o que exporia o token da
-- uazapi), criamos uma função SECURITY DEFINER que expõe só as colunas de branding.

alter table public.app_settings
  add column if not exists logo_url text,
  add column if not exists cor_primaria text not null default '#111827',
  add column if not exists cor_secundaria text not null default '#3b82f6',
  add column if not exists cor_texto text not null default '#111827',
  add column if not exists cor_fundo text not null default '#f5f6f8';

create or replace function public.get_branding()
returns table (
  logo_url text,
  cor_primaria text,
  cor_secundaria text,
  cor_texto text,
  cor_fundo text
)
language sql
security definer
set search_path = public
stable
as $$
  select logo_url, cor_primaria, cor_secundaria, cor_texto, cor_fundo
  from public.app_settings
  where id = 1;
$$;

grant execute on function public.get_branding() to anon, authenticated;

-- Bucket público para os arquivos de logo. Upload/troca restrito a admin_master; leitura
-- pública (a logo aparece na sidebar e tela de login para todos, inclusive sem sessão).
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read"
  on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists "logos_admin_master_insert" on storage.objects;
create policy "logos_admin_master_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos' and public.get_my_cargo() = 'admin_master');

drop policy if exists "logos_admin_master_update" on storage.objects;
create policy "logos_admin_master_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos' and public.get_my_cargo() = 'admin_master');

drop policy if exists "logos_admin_master_delete" on storage.objects;
create policy "logos_admin_master_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos' and public.get_my_cargo() = 'admin_master');
