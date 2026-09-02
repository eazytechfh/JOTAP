-- Redistribui um conjunto de leads igualmente entre os vendedores ativos.
-- A função inteira roda na transação da chamada RPC: qualquer validação que falhar desfaz tudo.
create or replace function public.redistribuir_leads(p_lead_ids bigint[])
returns table(lead_id bigint, vendedor text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cargo text;
  v_empresa bigint;
  v_total_ids integer;
  v_total_leads integer;
  v_total_vendedores integer;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '28000';
  end if;

  select cargo into v_cargo from public.profiles where id = auth.uid();
  if v_cargo is null or v_cargo not in ('admin_master', 'admin', 'gerente') then
    raise exception 'Você não tem permissão para redistribuir leads.' using errcode = '42501';
  end if;

  select count(*) into v_total_ids from (select distinct unnest(p_lead_ids)) ids;
  if coalesce(v_total_ids, 0) = 0 then
    raise exception 'Selecione pelo menos um lead.' using errcode = '22023';
  end if;

  -- Serializa redistribuições concorrentes da mesma instalação.
  perform pg_advisory_xact_lock(hashtextextended('redistribuir_leads', 0));

  select min(id_empresa), count(*), count(distinct id_empresa)
    into v_empresa, v_total_leads, v_total_vendedores
    from public."BASE_DE_LEADS"
   where id = any(p_lead_ids);

  if v_total_leads <> v_total_ids then
    raise exception 'Um ou mais leads não existem ou não estão acessíveis.' using errcode = 'P0002';
  end if;
  if v_total_vendedores <> 1 then
    raise exception 'Os leads selecionados devem pertencer à mesma empresa.' using errcode = '22023';
  end if;

  select count(*) into v_total_vendedores
    from public."VENDEDORES" v
   where v.ativo = true
     and v.id_empresa::text = v_empresa::text
     and exists (
       select 1 from public.profiles p
        where p.id = v.user_id
          and p.cargo = 'vendedor'
          and p.desativado = false
     );

  if v_total_vendedores = 0 then
    raise exception 'Nenhum vendedor ativo disponível para esta empresa.' using errcode = 'P0002';
  end if;

  return query
  with selected_leads as (
    select l.id::bigint as id,
           row_number() over (order by l.created_at nulls last, l.id) - 1 as position
      from public."BASE_DE_LEADS" l
     where l.id = any(p_lead_ids)
  ), active_sellers as (
    select v.vendedor,
           row_number() over (order by lower(trim(v.vendedor)), v.user_id) - 1 as position
      from public."VENDEDORES" v
     where v.ativo = true
       and v.id_empresa::text = v_empresa::text
       and exists (
         select 1 from public.profiles p
          where p.id = v.user_id
            and p.cargo = 'vendedor'
            and p.desativado = false
       )
  ), assignments as (
    select l.id, s.vendedor
      from selected_leads l
      join active_sellers s on s.position = mod(l.position, v_total_vendedores)
  ), updated as (
    update public."BASE_DE_LEADS" l
       set vendedor = a.vendedor,
           updated_at = now()
      from assignments a
     where l.id = a.id
    returning l.id::bigint, l.vendedor
  )
  select u.id, u.vendedor from updated u order by u.id;
end;
$$;

revoke all on function public.redistribuir_leads(bigint[]) from public, anon;
grant execute on function public.redistribuir_leads(bigint[]) to authenticated;

notify pgrst, 'reload schema';
