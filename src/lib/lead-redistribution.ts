export interface LeadAssignment {
  leadId: number;
  sellerName: string;
}

export function buildEqualAssignments(leadIds: number[], sellerNames: string[]): LeadAssignment[] {
  const sellers = sellerNames.map((name) => name.trim());
  if (sellers.some((name) => !name)) throw new Error('Vendedor inválido.');

  const uniqueLeadIds = [...new Set(leadIds)];
  if (uniqueLeadIds.length === 0) return [];
  if (sellers.length === 0) throw new Error('Nenhum vendedor ativo disponível.');

  return uniqueLeadIds.map((leadId, index) => ({
    leadId,
    sellerName: sellers[index % sellers.length],
  }));
}
