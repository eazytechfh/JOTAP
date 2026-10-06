-- EazyClick CRM — histórico de movimentações de estágio do lead (exibido no drawer do Pipeline).

create table if not exists public.lead_historico_estagio (
  id bigserial primary key,
  id_lead int4 not null references public."BASE_DE_LEADS"(id) on delete cascade,
  estagio_anterior text,
  estagio_novo text not null,
  usuario text,
  created_at timestamptz default now()
);

alter table public.lead_historico_estagio enable row level security;

drop policy if exists "lead_historico_estagio_all_authenticated" on public.lead_historico_estagio;
create policy "lead_historico_estagio_all_authenticated"
  on public.lead_historico_estagio for all
  to authenticated
  using (true)
  with check (true);
