import { describe, expect, it } from 'vitest';
import {
  DATA_REFERENCIA_OPTIONS,
  getCustomDateBoundaries,
  getDefaultCustomDateRange,
  getPreviousDateBoundaries,
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

  it('interpreta o intervalo personalizado como dias locais completos e inclusivos', () => {
    const range = getCustomDateBoundaries({ start: '2026-07-30', end: '2026-08-02' });

    expect(range?.start.getFullYear()).toBe(2026);
    expect(range?.start.getMonth()).toBe(6);
    expect(range?.start.getDate()).toBe(30);
    expect(range?.start.getHours()).toBe(0);
    expect(range?.end.getDate()).toBe(2);
    expect(range?.end.getHours()).toBe(23);
    expect(range?.end.getMilliseconds()).toBe(999);

    expect(isLeadWithinPeriod(
      '2026-07-30T00:00:00-03:00', undefined, 'personalizado', 'criacao', now,
      { start: '2026-07-30', end: '2026-08-02' }
    )).toBe(true);
    expect(isLeadWithinPeriod(
      '2026-08-02T23:59:59.999-03:00', undefined, 'personalizado', 'criacao', now,
      { start: '2026-07-30', end: '2026-08-02' }
    )).toBe(true);
    expect(isLeadWithinPeriod(
      '2026-08-03T00:00:00-03:00', undefined, 'personalizado', 'criacao', now,
      { start: '2026-07-30', end: '2026-08-02' }
    )).toBe(false);
  });

  it('recusa intervalo personalizado incompleto ou invertido', () => {
    expect(getCustomDateBoundaries({ start: '', end: '2026-08-02' })).toBeNull();
    expect(getCustomDateBoundaries({ start: '2026-08-03', end: '2026-08-02' })).toBeNull();
    expect(isLeadWithinPeriod(
      '2026-08-02T12:00:00-03:00', undefined, 'personalizado', 'criacao', now,
      { start: '2026-08-03', end: '2026-08-02' }
    )).toBe(false);
  });

  it('calcula para o dashboard o periodo anterior com a mesma duracao', () => {
    const current = getCustomDateBoundaries({ start: '2026-07-30', end: '2026-08-02' });
    expect(current).not.toBeNull();

    const previous = getPreviousDateBoundaries(current!);
    expect(previous.start.getFullYear()).toBe(2026);
    expect(previous.start.getMonth()).toBe(6);
    expect(previous.start.getDate()).toBe(26);
    expect(previous.start.getHours()).toBe(0);
    expect(previous.end.getDate()).toBe(29);
    expect(previous.end.getHours()).toBe(23);
    expect(previous.end.getMilliseconds()).toBe(999);
  });

  it('oferece por padrao os ultimos sete dias em formato local', () => {
    expect(getDefaultCustomDateRange(now)).toEqual({
      start: '2026-07-28',
      end: '2026-08-03',
    });
  });

  it('preserva dias locais completos ao atravessar horario de verao', () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const current = getCustomDateBoundaries({ start: '2026-03-08', end: '2026-03-09' });
      expect(current).not.toBeNull();
      const previous = getPreviousDateBoundaries(current!);
      expect(previous.start.getDate()).toBe(6);
      expect(previous.start.getHours()).toBe(0);
      expect(previous.end.getDate()).toBe(7);
      expect(previous.end.getHours()).toBe(23);
      expect(previous.end.getMilliseconds()).toBe(999);
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});
