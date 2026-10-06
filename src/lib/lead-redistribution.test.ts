import { describe, expect, it } from 'vitest';
import { buildEqualAssignments } from './lead-redistribution';

describe('buildEqualAssignments', () => {
  it('distribui em round-robin com diferença máxima de um lead', () => {
    expect(buildEqualAssignments([10, 11, 12, 13, 14], ['Ana', 'Bia'])).toEqual([
      { leadId: 10, sellerName: 'Ana' },
      { leadId: 11, sellerName: 'Bia' },
      { leadId: 12, sellerName: 'Ana' },
      { leadId: 13, sellerName: 'Bia' },
      { leadId: 14, sellerName: 'Ana' },
    ]);
  });

  it('mantém vendedores sem lead quando há menos leads que vendedores', () => {
    expect(buildEqualAssignments([1, 2], ['Ana', 'Bia', 'Caio'])).toEqual([
      { leadId: 1, sellerName: 'Ana' },
      { leadId: 2, sellerName: 'Bia' },
    ]);
  });

  it('remove IDs repetidos preservando a ordem', () => {
    expect(buildEqualAssignments([3, 3, 2], ['Ana'])).toEqual([
      { leadId: 3, sellerName: 'Ana' },
      { leadId: 2, sellerName: 'Ana' },
    ]);
  });

  it('retorna vazio sem leads e rejeita lista sem vendedores válidos', () => {
    expect(buildEqualAssignments([], ['Ana'])).toEqual([]);
    expect(() => buildEqualAssignments([1], [])).toThrow('Nenhum vendedor ativo');
    expect(() => buildEqualAssignments([1], ['  '])).toThrow('Vendedor inválido');
  });
});
