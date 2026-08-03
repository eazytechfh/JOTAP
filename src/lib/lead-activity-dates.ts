import type { LeadActivityDates } from '@/lib/lead-period-filter';

interface RawActivityDates {
  id_lead?: number | string;
  ultima_atualizacao?: string | null;
  ultima_movimentacao?: string | null;
  ultima_atividade?: string | null;
}

function toActivityDates(raw: RawActivityDates): LeadActivityDates {
  return {
    ultimaAtualizacao: raw.ultima_atualizacao ?? null,
    ultimaMovimentacao: raw.ultima_movimentacao ?? null,
    ultimaAtividade: raw.ultima_atividade ?? null,
  };
}

export function parseLeadActivityDates(data: unknown): Map<number, LeadActivityDates> {
  const result = new Map<number, LeadActivityDates>();

  if (Array.isArray(data)) {
    data.forEach((raw: RawActivityDates) => {
      const leadId = Number(raw.id_lead);
      if (Number.isFinite(leadId)) result.set(leadId, toActivityDates(raw));
    });
    return result;
  }

  if (!data || typeof data !== 'object') return result;
  Object.entries(data as Record<string, RawActivityDates>).forEach(([leadId, raw]) => {
    const numericLeadId = Number(leadId);
    if (Number.isFinite(numericLeadId)) result.set(numericLeadId, toActivityDates(raw));
  });
  return result;
}
