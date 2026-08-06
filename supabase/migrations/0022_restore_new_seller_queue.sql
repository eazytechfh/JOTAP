-- Restaura o vinculo entre usuarios vendedores e a fila operacional.
--
-- A automacao de distribuicao usa `atender` e `quantos_lead`. Esses campos so
-- recebem valores iniciais em uma linha nova e nunca sao alterados ao vincular
-- um acesso a um vendedor que ja existe.

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cargo text := coalesce(new.raw_app_meta_data->>'cargo', 'vendedor');
  v_nome text := nullif(trim(new.raw_user_meta_data->>'nome'), '');
  v_telefone text := nullif(trim(new.raw_user_meta_data->>'telefone'), '');
begin
  if v_cargo not in ('admin_master', 'admin', 'gerente', 'vendedor') then
    v_cargo := 'vendedor';
  end if;

  insert into public.profiles (id, nome, email, cargo)
  values (new.id, v_nome, new.email, v_cargo)
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email,
        cargo = excluded.cargo;

  if v_cargo = 'vendedor' and v_nome is not null then
    -- Evita duas linhas para o mesmo vendedor em cadastros concorrentes, mesmo
    -- sem impor uma constraint nova sobre a tabela operacional legada.
    perform pg_advisory_xact_lock(hashtextextended(lower(trim(v_nome)), 0));

    update public."VENDEDORES"
       set telefone = case
                        when nullif(trim(telefone), '') is null then v_telefone
                        else telefone
                      end,
           ativo = true
     where lower(trim(vendedor)) = lower(trim(v_nome));

    if not found then
      -- Um vendedor novo sempre entra aguardando. Nunca desloca o vendedor da
      -- vez e passa a integrar a ordem existente pelo novo id da tabela.
      insert into public."VENDEDORES" (vendedor, telefone, atender, quantos_lead, ativo)
      values (v_nome, v_telefone, 'espera', 0, true);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Repara somente perfis ativos que ficaram orfaos enquanto a versao da funcao
-- da migracao 0012 estava vigente. O DISTINCT ON escolhe um perfil por nome
-- normalizado, e a mesma trava do trigger impede duplicacao com um cadastro
-- concorrente. Linhas existentes, sua vez e seus contadores permanecem intactos.
do $$
declare
  v_profile record;
begin
  for v_profile in
    select distinct on (lower(trim(p.nome)))
           p.nome,
           lower(trim(p.nome)) as nome_normalizado
      from public.profiles p
     where p.cargo = 'vendedor'
       and p.desativado = false
       and nullif(trim(p.nome), '') is not null
     order by lower(trim(p.nome)), p.created_at, p.id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_profile.nome_normalizado, 0));

    insert into public."VENDEDORES" (vendedor, telefone, atender, quantos_lead, ativo)
    select v_profile.nome, null, 'espera', 0, true
     where not exists (
       select 1
         from public."VENDEDORES" v
        where lower(trim(v.vendedor)) = v_profile.nome_normalizado
     );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
