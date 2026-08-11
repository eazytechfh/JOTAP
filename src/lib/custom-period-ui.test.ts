import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  const absolute = resolve(process.cwd(), path);
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
}

const hook = read('src/hooks/useLeadFilters.ts');
const filterBar = read('src/components/LeadFiltersBar.tsx');
const picker = read('src/components/CustomDateRangePicker.tsx');
const dashboard = read('src/app/(app)/dashboard/page.tsx');

describe('filtro de periodo personalizado', () => {
  it('integra o intervalo escolhido aos filtros compartilhados de Leads e Pipeline', () => {
    expect(hook).toContain("{ value: 'personalizado', label: 'Personalizado' }");
    expect(hook).toContain("const [customStart, setCustomStart]");
    expect(hook).toContain("const [customEnd, setCustomEnd]");
    expect(hook).toContain('getDefaultCustomDateRange()');
    expect(hook).toMatch(
      /isLeadWithinPeriod\([\s\S]*?periodo,[\s\S]*?dataReferencia,[\s\S]*?new Date\(\),[\s\S]*?\{ start: customStart, end: customEnd \}/
    );
    expect(hook).toContain('customStart,');
    expect(hook).toContain('customEnd,');
    expect(hook).toContain('setCustomStart,');
    expect(hook).toContain('setCustomEnd,');
  });

  it('mostra dois campos de data somente quando Personalizado esta selecionado', () => {
    expect(filterBar).toContain("filters.periodo === 'personalizado'");
    expect(filterBar).toContain('<CustomDateRangePicker');
    expect(picker).toContain('Data inicial');
    expect(picker).toContain('Data final');
    expect(picker.match(/type="date"/g)).toHaveLength(2);
    expect(picker).toContain('max={end || undefined}');
    expect(picker).toContain('min={start || undefined}');
    expect(picker).toContain('if (!value) return');
  });

  it('integra o intervalo personalizado e sua comparacao na Visao Geral', () => {
    expect(dashboard).toContain("{ value: 'personalizado', label: 'Personalizado' }");
    expect(dashboard).toContain("case 'personalizado'");
    expect(dashboard).toContain('getCustomDateBoundaries(customRange)');
    expect(dashboard).toContain('getPreviousDateBoundaries(currentRange)');
    expect(dashboard).not.toContain('getCustomDateBoundaries(customRange) ??');
    expect(dashboard).toContain("periodo === 'personalizado'");
    expect(dashboard).toContain('<CustomDateRangePicker');
  });
});
