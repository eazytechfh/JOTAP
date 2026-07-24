-- JOTAP: auditoria de leads, fechamento obrigatório e Realtime.
create table if not exists public.lead_logs (
  id bigserial primary key,
  id_lead bigint not null,
  id_empresa bigint,
  acao text not null,
  responsavel_id uuid,
  responsavel_nome text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lead_logs_lead_created_idx on public.lead_logs (id_lead, created_at desc);
alter table public.lead_logs enable row level security;
drop policy if exists "jotap_lead_logs_select" on public.lead_logs;
create policy "jotap_lead_logs_select" on public.lead_logs for select to authenticated using (
  public.get_my_cargo() in ('admin_master','admin','gerente')
  or exists (select 1 from public."BASE_DE_LEADS" l where l.id = id_lead and lower(trim(l.vendedor)) = lower(trim(public.get_my_nome())))
);

create or replace function public.validar_fechamento_lead() returns trigger language plpgsql set search_path = public as $$
begin
  if lower(trim(coalesce(new.estagio_lead,''))) = 'fechado'
    and (nullif(trim(coalesce(new.nome_lead,'')),'') is null or new.valor is null or new.valor <= 0)
  then raise exception 'Nome do lead e valor maior que zero são obrigatórios para fechar a venda.' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_validar_fechamento_lead on public."BASE_DE_LEADS";
create trigger trg_validar_fechamento_lead before insert or update of estagio_lead,nome_lead,valor on public."BASE_DE_LEADS" for each row execute function public.validar_fechamento_lead();

create or replace function public.audit_base_de_leads() returns trigger language plpgsql security definer set search_path=public as $$
declare v_old jsonb := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
declare v_new jsonb := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
declare v_acao text; declare v_campos text[]; declare v_nome text;
begin
  select nome into v_nome from public.profiles where id=auth.uid();
  if tg_op='DELETE' then v_acao:='lead_excluido'; v_campos:=array[]::text[];
  elsif tg_op='INSERT' then v_acao:='lead_criado'; v_campos:=array['nome_lead'];
  else
    select coalesce(array_agg(key order by key),array[]::text[]) into v_campos from jsonb_each(v_new) n where (v_old->n.key) is distinct from n.value;
    if new.observacao_vendedor is distinct from old.observacao_vendedor then v_acao:=case when nullif(trim(coalesce(old.observacao_vendedor,'')),'') is null then 'observacao_adicionada' else 'observacao_alterada' end;
    elsif new.vendedor is distinct from old.vendedor then v_acao:='lead_transferido';
    elsif new.estagio_lead is distinct from old.estagio_lead then v_acao:='estagio_alterado';
    else v_acao:='lead_atualizado'; end if;
  end if;
  insert into public.lead_logs(id_lead,id_empresa,acao,responsavel_id,responsavel_nome,detalhes)
  values(coalesce(new.id,old.id),coalesce(new.id_empresa,old.id_empresa),v_acao,auth.uid(),coalesce(v_nome,case when auth.uid() is null then 'Sistema/automação' else 'Usuário' end),jsonb_build_object('campos_alterados',v_campos));
  return coalesce(new,old);
end $$;
drop trigger if exists trg_audit_base_de_leads on public."BASE_DE_LEADS";
create trigger trg_audit_base_de_leads after insert or update or delete on public."BASE_DE_LEADS" for each row execute function public.audit_base_de_leads();

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='BASE_DE_LEADS')
  then alter publication supabase_realtime add table public."BASE_DE_LEADS"; end if;
end $$;
