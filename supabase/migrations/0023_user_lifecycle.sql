-- Mantem o ciclo de vida do acesso sincronizado com as tabelas operacionais.

alter table public."VENDEDORES"
  add column if not exists user_id uuid;

-- Vincula apenas nomes inequivocos. Duplicidades permanecem sem vinculo e sao
-- recusadas pelas funcoes abaixo, em vez de arriscar alterar a pessoa errada.
update public."VENDEDORES" v
   set user_id = p.id
  from public.profiles p
 where v.user_id is null
   and p.cargo = 'vendedor'
   and lower(trim(v.vendedor)) = lower(trim(p.nome))
   and (select count(*) from public."VENDEDORES" vx
         where lower(trim(vx.vendedor)) = lower(trim(v.vendedor))) = 1
   and (select count(*) from public.profiles px
         where lower(trim(px.nome)) = lower(trim(p.nome))) = 1;

create unique index if not exists vendedores_user_id_unique
  on public."VENDEDORES" (user_id)
  where user_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'vendedores_user_id_fkey'
       and conrelid = 'public."VENDEDORES"'::regclass
  ) then
    alter table public."VENDEDORES"
      add constraint vendedores_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

-- Mantem o vinculo UUID para novos vendedores sem redefinir vez ou contadores
-- quando uma linha operacional existente e reaproveitada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cargo text := coalesce(new.raw_app_meta_data->>'cargo', 'vendedor');
  v_nome text := nullif(trim(new.raw_user_meta_data->>'nome'), '');
  v_telefone text := nullif(trim(new.raw_user_meta_data->>'telefone'), '');
begin
  if v_cargo not in ('admin_master', 'admin', 'gerente', 'vendedor') then
    v_cargo := 'vendedor';
  end if;

  insert into public.profiles (id, nome, email, cargo)
  values (new.id, v_nome, new.email, v_cargo)
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email,
        cargo = excluded.cargo;

  if v_cargo = 'vendedor' and v_nome is not null then
    perform pg_advisory_xact_lock(hashtextextended(lower(trim(v_nome)), 0));

    update public."VENDEDORES"
       set user_id = new.id,
           telefone = case
                        when nullif(trim(telefone), '') is null then v_telefone
                        else telefone
                      end,
           ativo = true
     where user_id = new.id
        or (
          user_id is null
          and lower(trim(vendedor)) = lower(trim(v_nome))
          and (select count(*) from public."VENDEDORES" vx
                where lower(trim(vx.vendedor)) = lower(trim(v_nome))) = 1
          and (select count(*) from public.profiles px
                where lower(trim(px.nome)) = lower(trim(v_nome))) = 1
        );

    if not found then
      insert into public."VENDEDORES"
        (vendedor, telefone, id_empresa, atender, quantos_lead, ativo, user_id)
      values (v_nome, v_telefone, 1, 'espera', 0, true, new.id);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.set_user_disabled(p_user_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_cargo text;
  v_matching_sellers integer;
  v_matching_profiles integer;
begin
  select nome, cargo into v_nome, v_cargo
    from public.profiles
   where id = p_user_id
   for update;

  if not found then
    raise exception 'Usuario nao encontrado.' using errcode = 'P0002';
  end if;

  if v_cargo = 'admin_master' then
    raise exception 'A conta admin master nao pode ser desativada.' using errcode = '42501';
  end if;

  update public.profiles
     set desativado = p_disabled
   where id = p_user_id;

  if v_cargo = 'vendedor' then
    if nullif(trim(v_nome), '') is null then
      raise exception 'Perfil vendedor sem nome operacional.' using errcode = 'P0001';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(lower(trim(v_nome)), 0));

    if not exists (select 1 from public."VENDEDORES" where user_id = p_user_id) then
      select count(*) into v_matching_profiles
        from public.profiles
       where cargo = 'vendedor'
         and lower(trim(nome)) = lower(trim(v_nome));

      if v_matching_profiles > 1 then
        raise exception 'Vinculo de perfil ambiguo; operacao cancelada.' using errcode = 'P0001';
      end if;

      select count(*) into v_matching_sellers
        from public."VENDEDORES"
       where user_id is null
         and lower(trim(vendedor)) = lower(trim(v_nome));

      if v_matching_sellers = 1 then
        update public."VENDEDORES"
           set user_id = p_user_id
         where user_id is null
           and lower(trim(vendedor)) = lower(trim(v_nome));
      elsif v_matching_sellers > 1 then
        raise exception 'Vinculo de vendedor ambiguo; operacao cancelada.' using errcode = 'P0001';
      end if;
    end if;

    update public."VENDEDORES"
       set ativo = not p_disabled,
           atender = case
                        when p_disabled then 'inativo'
                        when lower(trim(coalesce(atender, ''))) = 'inativo' then 'espera'
                        else atender
                      end
     where user_id = p_user_id;

    if not found then
      raise exception 'Linha operacional do vendedor nao encontrada.' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

revoke all on function public.set_user_disabled(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_user_disabled(uuid, boolean) to service_role;

-- Executado na mesma transacao do delete administrativo do Supabase Auth.
create or replace function public.cleanup_deleted_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_email text;
  v_cargo text;
  v_deleted_sellers integer;
  v_matching_sellers integer;
  v_matching_profiles integer;
begin
  select nome, email, cargo into v_nome, v_email, v_cargo
    from public.profiles
   where id = old.id
   for update;

  if v_cargo = 'admin_master' then
    raise exception 'A conta admin master nao pode ser excluida.' using errcode = '42501';
  end if;

  v_email := coalesce(nullif(trim(v_email), ''), old.email);

  delete from public."VENDEDORES"
   where user_id = old.id;
  get diagnostics v_deleted_sellers = row_count;

  -- Compatibilidade segura para linhas legadas ainda sem UUID: so remove quando
  -- existe exatamente uma correspondencia e ela nao pertence a outra conta.
  if v_deleted_sellers = 0 and v_cargo = 'vendedor' and nullif(trim(v_nome), '') is not null then
    select count(*) into v_matching_profiles
      from public.profiles
     where cargo = 'vendedor'
       and lower(trim(nome)) = lower(trim(v_nome));

    if v_matching_profiles > 1 then
      raise exception 'Vinculo de perfil ambiguo; exclusao cancelada.' using errcode = 'P0001';
    end if;

    select count(*) into v_matching_sellers
      from public."VENDEDORES"
     where lower(trim(vendedor)) = lower(trim(v_nome));

    if v_matching_sellers > 1 then
      raise exception 'Vinculo de vendedor ambiguo; exclusao cancelada.' using errcode = 'P0001';
    elsif v_matching_sellers = 1 then
      if exists (
        select 1 from public."VENDEDORES"
         where lower(trim(vendedor)) = lower(trim(v_nome))
           and user_id is not null
      ) then
        raise exception 'Vendedor vinculado a outra conta; exclusao cancelada.' using errcode = 'P0001';
      end if;

      delete from public."VENDEDORES"
       where user_id is null
         and lower(trim(vendedor)) = lower(trim(v_nome));
    end if;
  end if;

  -- usuarios e uma tabela operacional legada e pode nao existir em bancos novos.
  if to_regclass('public.usuarios') is not null and v_email is not null then
    execute 'delete from public.usuarios where lower(trim(email)) = lower(trim($1))'
      using v_email;
  end if;

  delete from public.profiles
   where id = old.id;

  return old;
end;
$$;

revoke all on function public.cleanup_deleted_auth_user() from public, anon, authenticated;

drop trigger if exists cleanup_deleted_auth_user on auth.users;
create trigger cleanup_deleted_auth_user
  before delete on auth.users
  for each row execute function public.cleanup_deleted_auth_user();

notify pgrst, 'reload schema';
