import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('pacote CRM automotivo Jotap', () => {
  it('notifica vendedor via realtime com fallback leve', () => {
    const source = read('src/components/LeadAssignedWatcher.tsx');
    expect(source).toContain("new Audio('/effects/lead-assigned.mp3')");
    expect(source).toContain("table: 'BASE_DE_LEADS'");
    expect(source).toContain('180_000');
    expect(source).toContain("lead-assignments-changed");
  });

  it('exige dados e celebra venda por cinco segundos', () => {
    const pipeline = read('src/app/(app)/pipeline/page.tsx');
    const celebration = read('src/components/SaleCelebration.tsx');
    expect(pipeline).toContain("novoEstagio === 'fechado'");
    expect(pipeline).toContain('VendaFechadaModal');
    expect(celebration).toContain('CELEBRATION_DURATION_MS = 5_000');
    expect(celebration).toContain('playAt(engine, 11)');
    expect(celebration).toContain('playAt(money, 5)');
    expect(celebration).toContain('Parabéns pela venda!');
  });

  it('mostra logs e histórico rolável', () => {
    const drawer = read('src/components/LeadDrawer.tsx');
    expect(drawer).toContain("from('lead_logs')");
    expect(drawer).toContain('Logs gerais');
    expect(drawer).toContain('ultimoLogObservacao');
    expect(drawer).toContain('max-h-64');
  });

  it('controla status do estoque e usa loading automotivo', () => {
    const inventory = read('src/app/(app)/estoque/page.tsx');
    expect(inventory).toContain('atualizarStatus');
    expect(inventory).toContain('Disponível');
    expect(inventory).toContain('Indisponível');
    expect(inventory).toContain('Vendido');
    expect(read('src/components/AutomotiveLoading.tsx')).toContain('automotive-loading-car');
  });

  it('vincula um veiculo pesquisavel e disponivel ao fechamento atomico', () => {
    const pipeline = read('src/app/(app)/pipeline/page.tsx');
    const sql = read('supabase/migrations/0016_venda_vinculada_estoque.sql');
    expect(pipeline).toContain("from('estoque')");
    expect(pipeline).toContain('Digite marca, modelo, ano ou placa');
    expect(pipeline).toContain('filteredVehicles');
    expect(pipeline).toContain('top-full');
    expect(pipeline).toContain("rpc('fechar_venda_com_veiculo'");
    expect(sql).toContain('estoque_veiculo_id');
    expect(sql).toContain('for update');
    expect(sql).toContain("v_status <> 'disponivel'");
    expect(sql).toContain("update public.estoque set status = 'Vendido'");
  });

  it('possui migration nova e segura', () => {
    const sql = read('supabase/migrations/0014_crm_automotivo_auditoria_realtime.sql');
    expect(sql).toContain('create table if not exists public.lead_logs');
    expect(sql).toContain('validar_fechamento_lead');
    expect(sql).toContain('supabase_realtime');
    expect(sql).toContain('lead_excluido');
  });

  it('agrega datas de atividade dos leads sem ignorar RLS', () => {
    const sql = read('supabase/migrations/0020_lead_activity_filter_json.sql');
    expect(sql).toContain('get_lead_activity_dates');
    expect(sql).toContain('security invoker');
    expect(sql).toContain("acao <> 'lead_criado'");
    expect(sql).toContain("acao = 'estagio_alterado'");
    expect(sql).toContain('grant execute on function');
    expect(sql).toContain("notify pgrst, 'reload schema'");
    expect(sql).toContain('returns jsonb');
    expect(sql).toContain('jsonb_object_agg');
    expect(sql).toContain('lead_historico_estagio');
    expect(sql).toContain('greatest(logs.ultima_atualizacao, history.ultima_movimentacao_historico) as ultima_atualizacao');
  });

  it('integra a referência de data ao filtro da pipeline', () => {
    const hook = read('src/hooks/useLeadFilters.ts');
    const activityHook = read('src/hooks/useLeadActivityDates.ts');
    const filters = read('src/components/LeadFiltersBar.tsx');
    expect(hook).toContain("useState<DataReferencia>('criacao')");
    expect(hook).toContain('isLeadWithinPeriod(');
    expect(activityHook).toContain("rpc('get_lead_activity_dates')");
    expect(activityHook).toContain('refreshActivityDates = useCallback');
    expect(activityHook).toContain('activityRequestRef');
    expect(activityHook).toContain('setActivityError(error.message)');
    expect(hook).not.toContain('}, [enableActivityDates, leads]);');
    expect(filters).toContain('Data considerada');
    expect(filters).toContain('DATA_REFERENCIA_OPTIONS');
    expect(filters).toContain('filters.activityLoading');
    expect(filters).toContain('filters.activityError');
    expect(read('src/app/(app)/pipeline/page.tsx')).toContain('await filters.refreshActivityDates()');
    expect(read('src/app/(app)/pipeline/page.tsx')).toContain('await refreshActivityDates();');
  });

  it('compartilha atividades com o dashboard e contabiliza atualizações e fechamentos', () => {
    const activityHook = read('src/hooks/useLeadActivityDates.ts');
    const leadFilters = read('src/hooks/useLeadFilters.ts');
    const dashboard = read('src/app/(app)/dashboard/page.tsx');
    expect(activityHook).toContain("rpc('get_lead_activity_dates')");
    expect(activityHook).toContain('activityRequestRef');
    expect(leadFilters).toContain('useLeadActivityDates(enableActivityDates)');
    expect(dashboard).toContain('useLeadActivityDates(true)');
    expect(dashboard).toContain('activityLoaded ?');
    expect(dashboard).toContain('setActivityLeads(allLeads)');
    expect(dashboard).toContain('Leads atualizados');
    expect(dashboard).toContain('Vendas fechadas');
    expect(dashboard).toContain('Valor fechado');
    expect(dashboard).toContain('dataKey="updated"');
  });
});
