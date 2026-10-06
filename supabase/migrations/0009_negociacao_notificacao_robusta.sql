-- EazyClick CRM — robustece o cronômetro de "Em Negociação" (0008_timer_negociacao.sql):
--
-- 1. Colunas para rastrear o envio da notificação ao webhook do n8n (WhatsApp), permitindo
--    retry sem duplicar o disparo mesmo com múltiplos navegadores/processos concorrentes
--    (painel flutuante do client + o cron externo em /api/negociacao/processar-vencidas).
-- 2. Function reivindicar_notificacao_negociacao(): UPDATE atômico que só uma chamada
--    concorrente consegue "ganhar" por lead, com destravamento automático de reivindicações
--    mortas (processo que reivindicou e morreu antes de concluir) após 2 minutos.

alter table public."BASE_DE_LEADS"
  add column if not exists negociacao_notificacao_status text
    check (negociacao_notificacao_status in ('enviando', 'erro', 'enviado')),
  add column if not exists negociacao_notificacao_tentativas int not null default 0,
  add column if not exists negociacao_notificacao_erro text,
  add column if not exists negociacao_notificacao_reivindicada_em timestamptz;

create or replace function public.reivindicar_notificacao_negociacao(p_lead_id bigint)
returns table (
  id bigint,
  nome_lead text,
  telefone text,
  vendedor text,
  negociacao_expira_em timestamptz,
  negociacao_notificacao_tentativas int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public."BASE_DE_LEADS" as l
  set
    negociacao_notificacao_status = 'enviando',
    negociacao_notificacao_tentativas = l.negociacao_notificacao_tentativas + 1,
    negociacao_notificacao_reivindicada_em = now()
  where l.id = p_lead_id
    and l.estagio_lead = 'em_negociacao'
    and l.negociacao_expira_em is not null
    and l.negociacao_expira_em <= now()
    and l.negociacao_notificado_em is null
    and (
      l.negociacao_notificacao_status is null
      or l.negociacao_notificacao_status = 'erro'
      or l.negociacao_notificacao_reivindicada_em < now() - interval '2 minutes'
    )
  returning
    l.id, l.nome_lead, l.telefone, l.vendedor, l.negociacao_expira_em,
    l.negociacao_notificacao_tentativas;
end;
$$;

-- Só o service_role (usado pelas rotas server-side com createAdminClient) pode reivindicar
-- notificações — nunca o client autenticado direto, senão um vendedor poderia forjar o disparo
-- do webhook para qualquer lead vencido.
revoke execute on function public.reivindicar_notificacao_negociacao(bigint) from public;
revoke execute on function public.reivindicar_notificacao_negociacao(bigint) from anon;
revoke execute on function public.reivindicar_notificacao_negociacao(bigint) from authenticated;
grant execute on function public.reivindicar_notificacao_negociacao(bigint) to service_role;
