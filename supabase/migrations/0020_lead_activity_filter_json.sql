drop function if exists public.get_lead_activity_dates();

create function public.get_lead_activity_dates()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with log_dates as (
    select
      logs.id_lead,
      max(logs.created_at) filter (where logs.acao <> 'lead_criado') as ultima_atualizacao,
      max(logs.created_at) filter (where logs.acao = 'estagio_alterado') as ultima_movimentacao_log,
      max(logs.created_at) as ultima_atividade_log
    from public.lead_logs as logs
    group by logs.id_lead
  ),
  history_dates as (
    select history.id_lead::bigint as id_lead, max(history.created_at) as ultima_movimentacao_historico
    from public.lead_historico_estagio as history
    group by history.id_lead
  ),
  visible_ids as (
    select id_lead from log_dates
    union
    select id_lead from history_dates
  ),
  combined as (
    select
      ids.id_lead,
      greatest(logs.ultima_atualizacao, history.ultima_movimentacao_historico) as ultima_atualizacao,
      greatest(logs.ultima_movimentacao_log, history.ultima_movimentacao_historico) as ultima_movimentacao,
      greatest(logs.ultima_atividade_log, history.ultima_movimentacao_historico) as ultima_atividade
    from visible_ids as ids
    left join log_dates as logs using (id_lead)
    left join history_dates as history using (id_lead)
  )
  select coalesce(
    jsonb_object_agg(
      combined.id_lead::text,
      jsonb_build_object(
        'ultima_atualizacao', combined.ultima_atualizacao,
        'ultima_movimentacao', combined.ultima_movimentacao,
        'ultima_atividade', combined.ultima_atividade
      )
    ),
    '{}'::jsonb
  )
  from combined;
$$;

revoke all on function public.get_lead_activity_dates() from public, anon;
grant execute on function public.get_lead_activity_dates() to authenticated;

notify pgrst, 'reload schema';
