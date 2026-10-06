-- EazyClick CRM - marcador simples para o scheduler de Follow-up no n8n.
-- O CRM grava "ativo" quando o lead entra em Follow-up e "inativo" quando sai.
-- O workflow agendado do n8n pode buscar BASE_DE_LEADS where follow_manual = 'ativo'.

alter table public."BASE_DE_LEADS"
  add column if not exists follow_manual text not null default 'inativo';

update public."BASE_DE_LEADS"
set follow_manual = case
  when lower(coalesce(estagio_lead, '')) = 'follow_up' then 'ativo'
  else 'inativo'
end;
