import { describe, expect, it } from 'vitest';
import { activeSellerNames } from './active-sellers';

describe('activeSellerNames', () => {
  it('usa somente vendedores ativos da tabela e remove nomes vazios ou repetidos', () => {
    expect(activeSellerNames([
      { vendedor: 'Ana', ativo: true },
      { vendedor: 'Antigo', ativo: false },
      { vendedor: ' Ana ', ativo: true },
      { vendedor: null, ativo: true },
      { vendedor: 'Bia', ativo: true },
    ])).toEqual(['Ana', 'Bia']);
  });

  it('não inclui vendedores históricos presentes apenas nos leads', () => {
    expect(activeSellerNames([{ vendedor: 'Atual', ativo: true }])).not.toContain('Vendedor histórico');
  });
});
