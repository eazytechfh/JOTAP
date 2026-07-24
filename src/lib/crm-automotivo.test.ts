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

  it('possui migration nova e segura', () => {
    const sql = read('supabase/migrations/0014_crm_automotivo_auditoria_realtime.sql');
    expect(sql).toContain('create table if not exists public.lead_logs');
    expect(sql).toContain('validar_fechamento_lead');
    expect(sql).toContain('supabase_realtime');
    expect(sql).toContain('lead_excluido');
  });
});
