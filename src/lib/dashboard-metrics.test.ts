import { describe, expect, it } from 'vitest';
import type { BaseDeLeads } from '@/types/database';
import {
  buildDailyLeadActivity,
  getActiveLeadsInRange,
  sumCurrentNegotiationValue,
} from './dashboard-metrics';
import type { LeadActivityDates } from './lead-period-filter';

const lead = (estagio: string, valor: number | null) => ({ estagio_lead: estagio, valor }) as BaseDeLeads;

describe('sumCurrentNegotiationValue', () => {
  it('soma toda a carteira atual em negociação, inclusive leads antigos', () => {
    expect(sumCurrentNegotiationValue([
      lead('em_negociacao', 100000),
      lead('EM_NEGOCIACAO', 50000),
      lead('oportunidade', 900000),
    ])).toBe(150000);
  });

  it('ignora valores nulos e não finitos', () => {
    expect(sumCurrentNegotiationValue([
      lead('em_negociacao', null),
      lead('em_negociacao', Number.NaN),
    ])).toBe(0);
  });
});

describe('métricas de atividade do dashboard', () => {
  const oldClosedLead = {
    id: 12737,
    created_at: '2025-11-28T12:30:00-03:00',
    estagio_lead: 'fechado',
    valor: 85000,
  } as BaseDeLeads;
  const recentLead = {
    id: 12738,
    created_at: '2026-08-02T10:00:00-03:00',
    estagio_lead: 'oportunidade',
    valor: null,
  } as BaseDeLeads;
  const activityByLead = new Map<number, LeadActivityDates>([
    [12737, {
      ultimaAtualizacao: '2026-08-03T13:48:00-03:00',
      ultimaMovimentacao: '2026-08-03T13:48:00-03:00',
      ultimaAtividade: '2026-08-03T13:48:00-03:00',
    }],
    [12738, {
      ultimaAtualizacao: '2026-07-20T09:00:00-03:00',
      ultimaMovimentacao: null,
      ultimaAtividade: '2026-08-02T10:00:00-03:00',
    }],
  ]);
  const range = {
    start: new Date('2026-07-28T00:00:00-03:00'),
    end: new Date('2026-08-03T23:59:59-03:00'),
  };

  it('agrupa criações e últimas atualizações em séries diárias separadas', () => {
    expect(buildDailyLeadActivity([oldClosedLead, recentLead], activityByLead, range)).toEqual([
      { dateKey: '2026-08-02', created: 1, updated: 0 },
      { dateKey: '2026-08-03', created: 0, updated: 1 },
    ]);
  });

  it('inclui nos detalhamentos leads criados ou atualizados no período', () => {
    expect(getActiveLeadsInRange([oldClosedLead, recentLead], activityByLead, range).map((item) => item.id)).toEqual([
      12737,
      12738,
    ]);
  });
});
