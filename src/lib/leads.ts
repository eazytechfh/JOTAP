import type { BaseDeLeads } from '@/types/database';

export const LEADS_PAGE_SIZE = 1000;
export type FetchLeadsPage = (from: number, to: number) => Promise<BaseDeLeads[]>;

export async function fetchAllLeads(fetchPage: FetchLeadsPage): Promise<BaseDeLeads[]> {
  const leads: BaseDeLeads[] = [];
  for (let from = 0; ; from += LEADS_PAGE_SIZE) {
    const page = await fetchPage(from, from + LEADS_PAGE_SIZE - 1);
    leads.push(...page);
    if (page.length < LEADS_PAGE_SIZE) return leads;
  }
}

function identityKey(lead: BaseDeLeads): string {
  let phone = (lead.telefone ?? '').replace(/\D/g, '');
  if (phone.length > 11 && phone.startsWith('55')) phone = phone.slice(2);
  if (phone) return `phone:${phone}`;
  const email = (lead.email ?? '').trim().toLocaleLowerCase('pt-BR');
  return email ? `email:${email}` : `id:${lead.id}`;
}

export function deduplicateLeads(input: BaseDeLeads[]) {
  const ordered = [...input].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  const seen = new Set<string>();
  const leads = ordered.filter((lead) => {
    const key = identityKey(lead);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { leads, duplicateCount: input.length - leads.length };
}
