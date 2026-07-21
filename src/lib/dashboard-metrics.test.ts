import { describe, expect, it } from 'vitest';
import type { BaseDeLeads } from '@/types/database';
import { sumCurrentNegotiationValue } from './dashboard-metrics';

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
