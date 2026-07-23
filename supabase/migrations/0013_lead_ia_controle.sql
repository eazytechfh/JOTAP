-- Controle local e auditável da IA por lead. Esta migration não chama serviços externos.

alter table public."BASE_DE_LEADS"
  add column if not exists bot_ativo varchar;

-- Instalações legadas armazenavam o estado como texto. Só convertemos os valores
-- conhecidos; qualquer valor desconhecido aborta a migration sem destruir dados.
do $$
declare
  v_tipo text;
  v_incompativeis bigint;
begin
  select data_type
    into v_tipo
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'BASE_DE_LEADS'
     and column_name = 'bot_ativo';

  execute $sql$
    select count(*)
      from public."BASE_DE_LEADS"
     where bot_ativo is not null
       and lower(trim(bot_ativo::text)) not in
         ('true', 'false', 't', 'f', '1', '0', 'ativo', 'inativo', 'sim', 'não', 'nao')
  $sql$ into v_incompativeis;

  if v_incompativeis > 0 then
    raise exception 'bot_ativo contém valor legado incompatível com varchar true/false';
  end if;

  if v_tipo <> 'character varying' then
    alter table public."BASE_DE_LEADS"
      alter column bot_ativo drop default,
      alter column bot_ativo type varchar
      using (bot_ativo::text);
  end if;
end;
$$;

alter table public."BASE_DE_LEADS"
  add column if not exists bot_ativo_alterado_em timestamptz;

update public."BASE_DE_LEADS"
set bot_ativo = case
  when lower(trim(bot_ativo)) in ('true', 't', '1', 'ativo', 'sim') then 'true'
  else 'false'
end;

alter table public."BASE_DE_LEADS"
  alter column bot_ativo set default 'false',
  alter column bot_ativo set not null;

-- A migration 0011 removeu a policy DELETE antiga. Recriamos a autorização
-- explicitamente para o tenant único e somente para os cargos de gestão.
drop policy if exists "jotap_leads_delete" on public."BASE_DE_LEADS";
create policy "jotap_leads_delete"
  on public."BASE_DE_LEADS" for delete
  to authenticated
  using (id_empresa = 1 and public.get_my_cargo() in ('admin_master', 'admin', 'gerente'));

-- Defesa em profundidade: mesmo se uma policy futura voltar a permitir update
-- do próprio perfil, um usuário comum não consegue alterar o campo cargo.
create or replace function public.protect_admin_master_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cargo IS DISTINCT FROM old.cargo
     and coalesce(public.get_my_cargo(), '') not in ('admin_master', 'admin', 'gerente') then
    raise exception 'Sem permissão para alterar cargo.'
      using errcode = '42501';
  end if;

  if new.cargo = 'admin_master'
     and old.cargo IS DISTINCT FROM 'admin_master'
     and coalesce(public.get_my_cargo(), '') <> 'admin_master' then
    raise exception 'Somente admin_master pode atribuir o cargo admin_master.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.registrar_alteracao_bot_ativo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.bot_ativo IS DISTINCT FROM old.bot_ativo then
    new.bot_ativo_alterado_em := now();
  else
    new.bot_ativo_alterado_em := old.bot_ativo_alterado_em;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_registrar_alteracao_bot_ativo on public."BASE_DE_LEADS";
create trigger trg_registrar_alteracao_bot_ativo
  before update of bot_ativo, bot_ativo_alterado_em
  on public."BASE_DE_LEADS"
  for each row
  execute function public.registrar_alteracao_bot_ativo();

notify pgrst, 'reload schema';
