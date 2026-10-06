import { describe, expect, it } from 'vitest';
import { parseLeadActivityDates } from './lead-activity-dates';

const dates = {
  ultima_atualizacao: '2026-08-03T16:00:00Z',
  ultima_movimentacao: '2026-08-03T15:00:00Z',
  ultima_atividade: '2026-08-03T16:00:00Z',
};

describe('parseLeadActivityDates', () => {
  it('aceita a resposta JSON da migration 0020', () => {
    expect(parseLeadActivityDates({ 12737: dates }).get(12737)?.ultimaAtualizacao).toBe(dates.ultima_atualizacao);
  });

  it('mantém compatibilidade com as linhas retornadas pela migration 0019', () => {
    expect(parseLeadActivityDates([{ id_lead: 12737, ...dates }]).get(12737)?.ultimaMovimentacao).toBe(dates.ultima_movimentacao);
  });
});
