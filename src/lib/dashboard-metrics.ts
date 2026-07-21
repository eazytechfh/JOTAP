import type { BaseDeLeads } from '@/types/database';

export function sumCurrentNegotiationValue(leads: BaseDeLeads[]): number {
  return leads
    .filter((lead) => (lead.estagio_lead ?? '').trim().toLowerCase() === 'em_negociacao')
    .reduce((sum, lead) => {
      const value = Number(lead.valor);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
}
