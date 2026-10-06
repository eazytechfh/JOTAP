create or replace function public.get_lead_activity_dates()
returns table (
  id_lead bigint,
  ultima_atualizacao timestamptz,
  ultima_movimentacao timestamptz,
  ultima_atividade timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    logs.id_lead,
    max(logs.created_at) filter (where logs.acao <> 'lead_criado') as ultima_atualizacao,
    max(logs.created_at) filter (where logs.acao = 'estagio_alterado') as ultima_movimentacao,
    max(logs.created_at) as ultima_atividade
  from public.lead_logs as logs
  group by logs.id_lead;
$$;

revoke all on function public.get_lead_activity_dates() from public, anon;
grant execute on function public.get_lead_activity_dates() to authenticated;

notify pgrst, 'reload schema';
