export interface SellerAvailability {
  vendedor: string | null;
  ativo: boolean;
}

export function activeSellerNames(sellers: SellerAvailability[]): string[] {
  const names = sellers
    .filter((seller) => seller.ativo)
    .map((seller) => seller.vendedor?.trim())
    .filter((name): name is string => Boolean(name));

  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
