import type { SupabaseClient } from '@supabase/supabase-js';

// Sentinela usada pelo modal de exclusão de vendedor para sinalizar "distribuir igualmente
// entre os outros vendedores ativos", em vez de um nome de vendedor específico de destino.
export const REDISTRIBUIR_IGUALMENTE = '__redistribuir_igualmente__';

/**
 * Normaliza e valida o valor `redistribuirPara` recebido do modal de exclusão de vendedor.
 *
 * Retorna:
 * - `null` quando o vendedor optou por deixar os leads sem vendedor (comportamento atual).
 * - `REDISTRIBUIR_IGUALMENTE` quando deve distribuir igualmente entre os demais vendedores
 *   ativos (via RPC `redistribuir_leads`).
 * - o nome normalizado de um vendedor específico de destino, nos demais casos.
 *
 * Lança erro se o destino for o mesmo vendedor que está sendo excluído.
 */
export function destinoRedistribuicao(destino: unknown, vendedorAtual: string): string | null {
  if (destino === null || destino === undefined || destino === '') return null;
  if (typeof destino !== 'string') throw new Error('Destino de redistribuição inválido.');

  const normalizado = destino.trim();
  if (!normalizado) return null;
  if (normalizado === REDISTRIBUIR_IGUALMENTE) return REDISTRIBUIR_IGUALMENTE;

  if (normalizado.localeCompare(vendedorAtual.trim(), 'pt-BR', { sensitivity: 'base' }) === 0) {
    throw new Error('Escolha um vendedor diferente para receber os leads.');
  }
  return normalizado.slice(0, 120);
}

/**
 * Lista os vendedores ativos elegíveis para receber os leads de um vendedor prestes a ser
 * excluído (usado para popular o `<select>` do modal de exclusão), excluindo o próprio
 * vendedor sendo excluído da lista de destinos.
 */
export async function listarDestinosRedistribuicao(
  supabase: SupabaseClient,
  vendedorExcluidoNome: string
): Promise<{ id: number; nome: string }[]> {
  const { data, error } = await supabase.from('VENDEDORES').select('id, vendedor').eq('ativo', true);
  if (error) throw error;

  const alvo = vendedorExcluidoNome.trim().toLowerCase();
  return ((data ?? []) as { id: number; vendedor: string | null }[])
    .filter((v) => v.vendedor && v.vendedor.trim().toLowerCase() !== alvo)
    .map((v) => ({ id: v.id, nome: v.vendedor as string }));
}
