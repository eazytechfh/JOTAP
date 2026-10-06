-- Remove integralmente o cronometro e as notificacoes de negociacao vencida.
-- Esta migration tambem limpa bancos que ja receberam as migrations 0008 e 0009.

drop trigger if exists trg_checar_extensao_negociacao on public."BASE_DE_LEADS";
drop function if exists public.checar_extensao_negociacao();
drop function if exists public.reivindicar_notificacao_negociacao(bigint);

alter table public."BASE_DE_LEADS"
  drop column if exists negociacao_expira_em,
  drop column if exists negociacao_notificado_em,
  drop column if exists negociacao_extensoes,
  drop column if exists negociacao_notificacao_status,
  drop column if exists negociacao_notificacao_tentativas,
  drop column if exists negociacao_notificacao_erro,
  drop column if exists negociacao_notificacao_reivindicada_em;

notify pgrst, 'reload schema';
