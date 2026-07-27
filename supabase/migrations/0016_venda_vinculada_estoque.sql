-- JOTA-P: vincula o veiculo ao lead e conclui a venda na mesma transacao.
-- Migration aditiva; execute uma unica vez depois da 0015.

alter table public."BASE_DE_LEADS"
  add column if not exists estoque_veiculo_id text;

create index if not exists base_de_leads_estoque_veiculo_id_idx
  on public."BASE_DE_LEADS" (estoque_veiculo_id);

create or replace function public.normalizar_texto_crm(p_texto text)
returns text language sql immutable set search_path = public as $$
  select translate(lower(trim(coalesce(p_texto, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;

create or replace function public.validar_fechamento_lead()
returns trigger language plpgsql set search_path = public as $$
begin
  if lower(trim(coalesce(new.estagio_lead, ''))) = 'fechado'
     and (
       nullif(trim(coalesce(new.nome_lead, '')), '') is null
       or new.valor is null
       or new.valor <= 0
       or nullif(trim(coalesce(new.estoque_veiculo_id, '')), '') is null
     ) then
    raise exception 'Nome, valor maior que zero e veiculo do estoque sao obrigatorios para fechar a venda.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_fechamento_lead on public."BASE_DE_LEADS";
create trigger trg_validar_fechamento_lead
  before insert or update of estagio_lead, nome_lead, valor, estoque_veiculo_id
  on public."BASE_DE_LEADS"
  for each row execute function public.validar_fechamento_lead();

create or replace function public.fechar_venda_com_veiculo(
  p_id_lead bigint,
  p_nome text,
  p_valor numeric,
  p_estoque_id text
)
returns public."BASE_DE_LEADS"
language plpgsql security definer set search_path = public as $$
declare
  v_lead public."BASE_DE_LEADS"%rowtype;
  v_veiculo_id text;
  v_status text;
  v_nome_usuario text := public.get_my_nome();
  v_cargo text := public.get_my_cargo();
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_nome, '')), '') is null or p_valor is null or p_valor <= 0 then
    raise exception 'Nome e valor maior que zero sao obrigatorios.' using errcode = '23514';
  end if;
  if nullif(trim(coalesce(p_estoque_id, '')), '') is null then
    raise exception 'Selecione o veiculo vendido.' using errcode = '23514';
  end if;

  select * into v_lead from public."BASE_DE_LEADS" where id = p_id_lead for update;
  if not found then
    raise exception 'Lead nao encontrado.' using errcode = 'P0002';
  end if;

  if coalesce(v_cargo, '') not in ('admin_master', 'admin', 'gerente')
     and coalesce(public.normalizar_texto_crm(v_lead.vendedor), '') <>
         coalesce(public.normalizar_texto_crm(v_nome_usuario), '__sem_perfil__') then
    raise exception 'Sem permissao para fechar esta venda.' using errcode = '42501';
  end if;

  select id::text, public.normalizar_texto_crm(status) into v_veiculo_id, v_status
  from public.estoque where id::text = trim(p_estoque_id) for update;
  if not found then
    raise exception 'Veiculo nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'disponivel' then
    raise exception 'O veiculo selecionado nao esta disponivel.' using errcode = '23514';
  end if;

  update public.estoque set status = 'Vendido', updated_at = now() where id::text = v_veiculo_id;
  update public."BASE_DE_LEADS"
  set nome_lead = trim(p_nome), valor = p_valor, estagio_lead = 'fechado',
      estoque_veiculo_id = v_veiculo_id
  where id = p_id_lead returning * into v_lead;
  return v_lead;
end;
$$;

revoke all on function public.fechar_venda_com_veiculo(bigint, text, numeric, text) from public;
revoke all on function public.fechar_venda_com_veiculo(bigint, text, numeric, text) from anon;
grant execute on function public.fechar_venda_com_veiculo(bigint, text, numeric, text) to authenticated;
notify pgrst, 'reload schema';
