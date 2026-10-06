-- JOTAP: corrige regressão da 0011/0012 que deixou public.estoque sem policy de escrita.
-- A 0011 substituiu a policy "for all" herdada (0002, sobre "ESTOQUE") por uma policy somente
-- de select em public.estoque (nome real da tabela, minúsculo, usado pela UI). Sem policy de
-- update, toda alteração de status do veículo era rejeitada silenciosamente pelo RLS (0 linhas
-- afetadas), fazendo a tela de Estoque exibir "Não foi possível alterar o status do veículo."

drop policy if exists "jotap_estoque_update" on public.estoque;
create policy "jotap_estoque_update" on public.estoque for update to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
