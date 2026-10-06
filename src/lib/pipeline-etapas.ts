import type { PipelineEtapa } from '@/types/database';

export const ETAPAS_PROTEGIDAS = new Set([
  'oportunidade',
  'em_qualificacao',
  'em_negociacao',
  'follow_up',
]);

export const ETAPAS_FALLBACK: PipelineEtapa[] = [
  ['oportunidade', 'Oportunidade', '#22c55e'],
  ['em_qualificacao', 'Em qualificação', '#3b82f6'],
  ['em_negociacao', 'Em negociação', '#f59e0b'],
  ['follow_up', 'Follow-up', '#8b5cf6'],
  ['fechado', 'Fechado', '#16a34a'],
  ['nao_fechou', 'Não fechou', '#ef4444'],
  ['transferidos', 'Transferidos', '#6b7280'],
  ['pesquisa_atendimento', 'Lembrete interno', '#06b6d4'],
].map(([id, nome, cor], index) => ({
  id,
  nome,
  cor,
  ordem: (index + 1) * 10,
  ativa: true,
}));

export function normalizarSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export function etapaDe(
  id: string | null | undefined,
  etapas: PipelineEtapa[]
): PipelineEtapa {
  const key = (id ?? '').trim().toLowerCase();
  return (
    etapas.find((etapa) => etapa.id === key) ?? {
      id: key || 'desconhecido',
      nome: key || 'Desconhecido',
      cor: '#6b7280',
      ordem: Number.MAX_SAFE_INTEGER,
      ativa: true,
    }
  );
}

export function etapaProtegida(id: string | null | undefined): boolean {
  return ETAPAS_PROTEGIDAS.has((id ?? '').trim().toLowerCase());
}
