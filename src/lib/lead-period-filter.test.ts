import { describe, expect, it } from 'vitest';
import {
  DATA_REFERENCIA_OPTIONS,
  isLeadWithinPeriod,
  type LeadActivityDates,
} from './lead-period-filter';

const now = new Date('2026-08-03T15:00:00-03:00');
const activity: LeadActivityDates = {
  ultimaAtualizacao: '2026-08-01T12:00:00-03:00',
  ultimaMovimentacao: '2026-07-31T18:00:00-03:00',
  ultimaAtividade: '2026-08-02T09:00:00-03:00',
};

describe('isLeadWithinPeriod', () => {
  it('oferece as quatro referências com criação como padrão visual', () => {
    expect(DATA_REFERENCIA_OPTIONS).toEqual([
      { value: 'criacao', label: 'Criação' },
      { value: 'ultima_atualizacao', label: 'Última atualização' },
      { value: 'movimentacao_etapa', label: 'Movimentação de etapa' },
      { value: 'qualquer_atividade', label: 'Qualquer atividade' },
    ]);
  });

  it('usa created_at quando a referência é criação', () => {
    expect(isLeadWithinPeriod('2025-11-28T12:30:00-03:00', activity, '7d', 'criacao', now)).toBe(false);
    expect(isLeadWithinPeriod('2026-07-31T12:30:00-03:00', activity, '7d', 'criacao', now)).toBe(true);
  });

  it('usa a última atualização sem confundi-la com a criação', () => {
    expect(isLeadWithinPeriod('2025-11-28T12:30:00-03:00', activity, '7d', 'ultima_atualizacao', now)).toBe(true);
    expect(isLeadWithinPeriod('2026-08-03T12:30:00-03:00', undefined, '7d', 'ultima_atualizacao', now)).toBe(false);
  });

  it('usa separadamente movimentação de etapa e qualquer atividade', () => {
    expect(isLeadWithinPeriod('2025-11-28T12:30:00-03:00', activity, 'hoje', 'movimentacao_etapa', now)).toBe(false);
    expect(isLeadWithinPeriod('2025-11-28T12:30:00-03:00', activity, '7d', 'movimentacao_etapa', now)).toBe(true);
    expect(isLeadWithinPeriod('2025-11-28T12:30:00-03:00', activity, 'ontem', 'qualquer_atividade', now)).toBe(true);
  });

  it('inclui exatamente o início local do período de sete dias', () => {
    expect(isLeadWithinPeriod('2026-07-27T00:00:00-03:00', undefined, '7d', 'criacao', now)).toBe(true);
    expect(isLeadWithinPeriod('2026-07-26T23:59:59-03:00', undefined, '7d', 'criacao', now)).toBe(false);
  });

  it('limita ontem entre o início de ontem e o início de hoje', () => {
    expect(isLeadWithinPeriod('2026-08-02T00:00:00-03:00', undefined, 'ontem', 'criacao', now)).toBe(true);
    expect(isLeadWithinPeriod('2026-08-03T00:00:00-03:00', undefined, 'ontem', 'criacao', now)).toBe(false);
  });

  it('não restringe resultados quando o período é todos', () => {
    expect(isLeadWithinPeriod('2025-11-28T12:30:00-03:00', undefined, 'todos', 'ultima_atualizacao', now)).toBe(true);
  });
});
