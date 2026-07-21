import { describe, expect, it, vi } from 'vitest';
import type { BaseDeLeads } from '@/types/database';
import { deduplicateLeads, fetchAllLeads } from './leads';

function lead(id: number, createdAt: string, telefone: string | null, email: string | null) {
  return { id, created_at: createdAt, telefone, email } as BaseDeLeads;
}

describe('fetchAllLeads', () => {
  it('continua buscando em lotes de 1.000 até receber uma página incompleta', async () => {
    const first = Array.from({ length: 1000 }, (_, index) => lead(index, '2026-01-02', String(index), null));
    const second = [lead(1000, '2026-01-01', '1000', null)];
    const fetchPage = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const result = await fetchAllLeads(fetchPage);
    expect(result).toHaveLength(1001);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 999);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

describe('deduplicateLeads', () => {
  it('normaliza símbolos e o prefixo brasileiro 55 do telefone', () => {
    const result = deduplicateLeads([
      lead(2, '2026-01-02T00:00:00Z', '+55 (11) 99999-0000', null),
      lead(1, '2026-01-01T00:00:00Z', '11 99999-0000', null),
    ]);
    expect(result.leads.map(({ id }) => id)).toEqual([2]);
    expect(result.duplicateCount).toBe(1);
  });

  it('usa e-mail normalizado quando não há telefone', () => {
    const result = deduplicateLeads([
      lead(2, '2026-01-02T00:00:00Z', '', ' Pessoa@Example.com '),
      lead(1, '2026-01-01T00:00:00Z', null, 'pessoa@example.com'),
    ]);
    expect(result.leads.map(({ id }) => id)).toEqual([2]);
  });

  it('preserva por id os leads sem telefone nem e-mail', () => {
    const result = deduplicateLeads([
      lead(2, '2026-01-02T00:00:00Z', null, null),
      lead(1, '2026-01-01T00:00:00Z', '', ''),
    ]);
    expect(result.leads.map(({ id }) => id)).toEqual([2, 1]);
    expect(result.duplicateCount).toBe(0);
  });

  it('preserva o registro mais recente mesmo quando a entrada está fora de ordem', () => {
    const result = deduplicateLeads([
      lead(1, '2026-01-01T00:00:00Z', '11999990000', null),
      lead(2, '2026-01-03T00:00:00Z', '11999990000', null),
    ]);
    expect(result.leads.map(({ id }) => id)).toEqual([2]);
  });
});
