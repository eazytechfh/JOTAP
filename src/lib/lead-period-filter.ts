export type Periodo = 'hoje' | 'ontem' | '7d' | '30d' | '90d' | 'todos';
export type DataReferencia =
  | 'criacao'
  | 'ultima_atualizacao'
  | 'movimentacao_etapa'
  | 'qualquer_atividade';

export const DATA_REFERENCIA_OPTIONS: Array<{ value: DataReferencia; label: string }> = [
  { value: 'criacao', label: 'Criação' },
  { value: 'ultima_atualizacao', label: 'Última atualização' },
  { value: 'movimentacao_etapa', label: 'Movimentação de etapa' },
  { value: 'qualquer_atividade', label: 'Qualquer atividade' },
];

export interface LeadActivityDates {
  ultimaAtualizacao: string | null;
  ultimaMovimentacao: string | null;
  ultimaAtividade: string | null;
}

function startOfDaysAgo(now: Date, days: number): Date {
  const boundary = new Date(now);
  boundary.setDate(boundary.getDate() - days);
  boundary.setHours(0, 0, 0, 0);
  return boundary;
}

function referenceDate(
  createdAt: string,
  activity: LeadActivityDates | undefined,
  dataReferencia: DataReferencia
): string | null {
  switch (dataReferencia) {
    case 'criacao':
      return createdAt;
    case 'ultima_atualizacao':
      return activity?.ultimaAtualizacao ?? null;
    case 'movimentacao_etapa':
      return activity?.ultimaMovimentacao ?? null;
    case 'qualquer_atividade':
      return activity?.ultimaAtividade ?? null;
  }
}

export function isLeadWithinPeriod(
  createdAt: string,
  activity: LeadActivityDates | undefined,
  periodo: Periodo,
  dataReferencia: DataReferencia,
  now = new Date()
): boolean {
  if (periodo === 'todos') return true;

  const rawDate = referenceDate(createdAt, activity, dataReferencia);
  if (!rawDate) return false;

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return false;

  if (periodo === 'ontem') {
    return date >= startOfDaysAgo(now, 1) && date < startOfDaysAgo(now, 0);
  }

  const daysByPeriod: Record<Exclude<Periodo, 'ontem' | 'todos'>, number> = {
    hoje: 0,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };

  return date >= startOfDaysAgo(now, daysByPeriod[periodo]);
}
