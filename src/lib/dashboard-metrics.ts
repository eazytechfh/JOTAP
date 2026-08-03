import type { BaseDeLeads } from '@/types/database';
import type { LeadActivityDates } from '@/lib/lead-period-filter';

interface DateRange {
  start: Date;
  end: Date;
}

function isDateInRange(value: string | null | undefined, range: DateRange): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
}

function localDateKey(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function leadIdentityKey(lead: BaseDeLeads): string {
  let phone = (lead.telefone ?? '').replace(/\D/g, '');
  if (phone.length > 11 && phone.startsWith('55')) phone = phone.slice(2);
  if (phone) return `phone:${phone}`;
  const email = (lead.email ?? '').trim().toLocaleLowerCase('pt-BR');
  return email ? `email:${email}` : `id:${lead.id}`;
}

export function sumCurrentNegotiationValue(leads: BaseDeLeads[]): number {
  return leads
    .filter((lead) => (lead.estagio_lead ?? '').trim().toLowerCase() === 'em_negociacao')
    .reduce((sum, lead) => {
      const value = Number(lead.valor);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
}

export function getDashboardActivityMetrics(
  leads: BaseDeLeads[],
  activityByLead: Map<number, LeadActivityDates>,
  range: DateRange
) {
  const updatedIdentities = new Set<string>();
  let closedSales = 0;
  let closedValue = 0;

  leads.forEach((lead) => {
    const activity = activityByLead.get(lead.id);
    if (isDateInRange(activity?.ultimaAtualizacao, range)) {
      updatedIdentities.add(leadIdentityKey(lead));
    }

    const isClosed = (lead.estagio_lead ?? '').trim().toLowerCase() === 'fechado';
    if (isClosed && isDateInRange(activity?.ultimaMovimentacao, range)) {
      closedSales += 1;
      const value = Number(lead.valor);
      if (Number.isFinite(value)) closedValue += value;
    }
  });

  return { updatedLeads: updatedIdentities.size, closedSales, closedValue };
}

export function buildDailyLeadActivity(
  leads: BaseDeLeads[],
  activityByLead: Map<number, LeadActivityDates>,
  range: DateRange
) {
  const totals = new Map<string, { created: number; updated: number }>();
  const increment = (dateKey: string, field: 'created' | 'updated') => {
    const current = totals.get(dateKey) ?? { created: 0, updated: 0 };
    current[field] += 1;
    totals.set(dateKey, current);
  };

  const latestCreationByIdentity = new Map<string, string>();
  const latestUpdateByIdentity = new Map<string, string>();
  leads.forEach((lead) => {
    const identity = leadIdentityKey(lead);
    const knownCreation = latestCreationByIdentity.get(identity);
    if (!knownCreation || Date.parse(lead.created_at) > Date.parse(knownCreation)) {
      latestCreationByIdentity.set(identity, lead.created_at);
    }

    const updatedAt = activityByLead.get(lead.id)?.ultimaAtualizacao;
    const knownUpdate = latestUpdateByIdentity.get(identity);
    if (updatedAt && (!knownUpdate || Date.parse(updatedAt) > Date.parse(knownUpdate))) {
      latestUpdateByIdentity.set(identity, updatedAt);
    }
  });

  latestCreationByIdentity.forEach((createdAt) => {
    if (isDateInRange(createdAt, range)) {
      const dateKey = localDateKey(createdAt);
      if (dateKey) increment(dateKey, 'created');
    }
  });

  latestUpdateByIdentity.forEach((updatedAt) => {
    if (isDateInRange(updatedAt, range)) {
      const dateKey = localDateKey(updatedAt);
      if (dateKey) increment(dateKey, 'updated');
    }
  });

  return Array.from(totals.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, values]) => ({ dateKey, ...values }));
}
