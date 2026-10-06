-- Permite excluir etapas editáveis mesmo quando possuem leads.
-- A realocação e a exclusão acontecem na mesma transação.

begin;

create or replace function public.excluir_pipeline_etapa(
  p_id text,
  p_destino text default 'oportunidade'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if public.get_my_cargo() not in ('admin_master', 'admin', 'gerente') then
    raise exception 'Sem permissão para excluir etapas.'
      using errcode = '42501';
  end if;

  if public.pipeline_etapa_protegida(p_id) then
    raise exception 'Esta etapa é protegida por automações e não pode ser excluída.'
      using errcode = '42501';
  end if;

  if p_id = p_destino then
    raise exception 'A etapa de destino deve ser diferente da etapa excluída.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.pipeline_etapas
    where id = p_id
      and ativa = true
  ) then
    raise exception 'Etapa inexistente ou inativa: %', p_id
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.pipeline_etapas
    where id = p_destino
      and ativa = true
  ) then
    raise exception 'Etapa de destino inexistente ou inativa: %', p_destino
      using errcode = '23503';
  end if;

  select count(*)
    into v_total
    from public."BASE_DE_LEADS"
   where estagio_lead = p_id;

  insert into public.lead_historico_estagio (
    id_lead,
    estagio_anterior,
    estagio_novo,
    usuario
  )
  select
    id,
    p_id,
    p_destino,
    coalesce(public.get_my_nome(), 'Sistema')
  from public."BASE_DE_LEADS"
  where estagio_lead = p_id;

  update public."BASE_DE_LEADS"
     set estagio_lead = p_destino
   where estagio_lead = p_id;

  delete from public.pipeline_etapas
   where id = p_id;

  return v_total;
end;
$$;

revoke all on function public.excluir_pipeline_etapa(text, text) from public, anon;
grant execute on function public.excluir_pipeline_etapa(text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
