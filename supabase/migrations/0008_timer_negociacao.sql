-- EazyClick CRM — cronômetro de 30 minutos para leads em "Em Negociação".
--
-- Quando um lead entra em "em_negociacao", o app grava negociacao_expira_em (agora + 30min).
-- Ao expirar, o n8n (via polling externo no Supabase) dispara a notificação de WhatsApp
-- para o vendedor e o app exibe um popup para quem estiver com o lead visível.
-- Gerente/Admin podem estender o prazo em +30min a partir do popup; essa extensão é
-- restrita por role diretamente no banco (trigger abaixo), pois a RLS de UPDATE em
-- BASE_DE_LEADS permite que o próprio vendedor edite o seu lead.

alter table public."BASE_DE_LEADS"
  add column if not exists negociacao_expira_em timestamptz,
  add column if not exists negociacao_notificado_em timestamptz,
  add column if not exists negociacao_extensoes int not null default 0;

create or replace function public.checar_extensao_negociacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.negociacao_extensoes > old.negociacao_extensoes
     and public.get_my_cargo() not in ('admin_master', 'admin', 'gerente') then
    raise exception 'Apenas gerente ou admin podem estender o cronômetro de negociação.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_checar_extensao_negociacao on public."BASE_DE_LEADS";
create trigger trg_checar_extensao_negociacao
  before update on public."BASE_DE_LEADS"
  for each row
  execute function public.checar_extensao_negociacao();
