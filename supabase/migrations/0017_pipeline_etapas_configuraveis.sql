-- JOTA-P: etapas configuráveis do pipeline sobre o schema legado
-- pipeline_etapas(id text, nome text, ordem integer, cor text, ativa boolean).

begin;

-- O banco de produção possuía um CHECK estático com as oito etapas antigas.
-- A validação passa a ser feita pelo trigger dinâmico ao final desta migration.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'BASE_DE_LEADS'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%estagio_lead%'
  loop
    execute format(
      'alter table public."BASE_DE_LEADS" drop constraint %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

insert into public.pipeline_etapas (id, nome, ordem, cor, ativa) values
  ('oportunidade', 'Oportunidade', 10, '#22c55e', true),
  ('em_qualificacao', 'Em qualificação', 20, '#3b82f6', true),
  ('em_negociacao', 'Em negociação', 30, '#f59e0b', true),
  ('follow_up', 'Follow-up', 40, '#8b5cf6', true),
  ('fechado', 'Fechado', 50, '#16a34a', true),
  ('nao_fechou', 'Não fechou', 60, '#ef4444', true),
  ('transferidos', 'Transferidos', 70, '#6b7280', true),
  ('pesquisa_atendimento', 'Lembrete interno', 80, '#06b6d4', true)
on conflict (id) do nothing;

grant select, insert, update, delete on table public.pipeline_etapas to authenticated;
alter table public.pipeline_etapas enable row level security;

drop policy if exists "jotap_pipeline_write" on public.pipeline_etapas;
drop policy if exists "pipeline_etapas_select" on public.pipeline_etapas;
drop policy if exists "pipeline_etapas_insert" on public.pipeline_etapas;
drop policy if exists "pipeline_etapas_update" on public.pipeline_etapas;
drop policy if exists "pipeline_etapas_delete" on public.pipeline_etapas;

create policy "pipeline_etapas_select"
  on public.pipeline_etapas for select
  to authenticated
  using (true);

create policy "pipeline_etapas_insert"
  on public.pipeline_etapas for insert
  to authenticated
  with check (public.get_my_cargo() in ('admin_master', 'admin', 'gerente'));

create policy "pipeline_etapas_update"
  on public.pipeline_etapas for update
  to authenticated
  using (public.get_my_cargo() in ('admin_master', 'admin', 'gerente'))
  with check (public.get_my_cargo() in ('admin_master', 'admin', 'gerente'));

create policy "pipeline_etapas_delete"
  on public.pipeline_etapas for delete
  to authenticated
  using (public.get_my_cargo() in ('admin_master', 'admin', 'gerente'));

create or replace function public.pipeline_etapa_protegida(p_id text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_id, '') in (
    'oportunidade',
    'em_qualificacao',
    'em_negociacao',
    'follow_up'
  );
$$;

create or replace function public.proteger_pipeline_etapa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'O identificador interno da etapa não pode ser alterado.'
        using errcode = '23514';
    end if;

    if public.pipeline_etapa_protegida(old.id)
       and (
         new.nome is distinct from old.nome
         or new.cor is distinct from old.cor
         or new.ordem is distinct from old.ordem
         or new.ativa is distinct from old.ativa
       ) then
      raise exception 'Esta etapa é protegida por automações e não pode ser alterada.'
        using errcode = '42501';
    end if;
  end if;

  if length(btrim(new.nome)) not between 1 and 60 then
    raise exception 'O nome da etapa deve ter entre 1 e 60 caracteres.'
      using errcode = '23514';
  end if;

  if new.cor !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'A cor da etapa deve usar o formato hexadecimal #RRGGBB.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_pipeline_etapa on public.pipeline_etapas;
create trigger trg_proteger_pipeline_etapa
  before insert or update on public.pipeline_etapas
  for each row execute function public.proteger_pipeline_etapa();

create or replace function public.impedir_exclusao_etapa_em_uso()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.pipeline_etapa_protegida(old.id) then
    raise exception 'Esta etapa é protegida por automações e não pode ser excluída.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public."BASE_DE_LEADS"
    where estagio_lead = old.id
  ) then
    raise exception 'Esta etapa possui leads. Mova-os antes de excluí-la.'
      using errcode = '23503';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_impedir_exclusao_etapa_em_uso on public.pipeline_etapas;
create trigger trg_impedir_exclusao_etapa_em_uso
  before delete on public.pipeline_etapas
  for each row execute function public.impedir_exclusao_etapa_em_uso();

create or replace function public.reordenar_pipeline_etapas(p_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_index integer;
begin
  if public.get_my_cargo() not in ('admin_master', 'admin', 'gerente') then
    raise exception 'Sem permissão para reordenar etapas.'
      using errcode = '42501';
  end if;

  if coalesce(array_length(p_ids, 1), 0) <> (
    select count(*) from public.pipeline_etapas where ativa = true
  ) then
    raise exception 'A lista deve conter todas as etapas ativas.'
      using errcode = '23514';
  end if;

  if exists (
    select id from public.pipeline_etapas where ativa = true
    except
    select unnest(p_ids)
  ) or exists (
    select unnest(p_ids)
    except
    select id from public.pipeline_etapas where ativa = true
  ) then
    raise exception 'A lista de etapas é inválida.'
      using errcode = '23514';
  end if;

  for v_index in 1..array_length(p_ids, 1) loop
    v_id := p_ids[v_index];
    update public.pipeline_etapas
       set ordem = v_index * 10
     where id = v_id;
  end loop;
end;
$$;

revoke all on function public.reordenar_pipeline_etapas(text[]) from public, anon;
grant execute on function public.reordenar_pipeline_etapas(text[]) to authenticated;

create or replace function public.validar_estagio_lead_configurado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.pipeline_etapas
    where id = new.estagio_lead
      and ativa = true
  ) then
    raise exception 'Etapa do pipeline inexistente ou inativa: %', new.estagio_lead
      using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_estagio_lead_configurado on public."BASE_DE_LEADS";
create trigger trg_validar_estagio_lead_configurado
  before insert or update of estagio_lead on public."BASE_DE_LEADS"
  for each row execute function public.validar_estagio_lead_configurado();

notify pgrst, 'reload schema';

commit;
