-- EazyClick CRM — campos adicionais de detalhe do lead (ficha exibida no drawer do Pipeline)
-- e tabela de vínculo N:N entre leads e etiquetas.

alter table public."BASE_DE_LEADS"
  add column if not exists cpf varchar,
  add column if not exists data_nascimento date,
  add column if not exists score_serasa integer;

create table if not exists public.lead_etiquetas (
  id bigserial primary key,
  id_lead int4 not null references public."BASE_DE_LEADS"(id) on delete cascade,
  id_etiqueta bigint not null references public.etiquetas(id) on delete cascade,
  created_at timestamptz default now(),
  unique (id_lead, id_etiqueta)
);

alter table public.lead_etiquetas enable row level security;

drop policy if exists "lead_etiquetas_all_authenticated" on public.lead_etiquetas;
create policy "lead_etiquetas_all_authenticated"
  on public.lead_etiquetas for all
  to authenticated
  using (true)
  with check (true);
