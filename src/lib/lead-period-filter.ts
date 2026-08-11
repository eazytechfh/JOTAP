export type Periodo = 'hoje' | 'ontem' | '7d' | '30d' | '90d' | 'personalizado' | 'todos';
export interface CustomDateRange {
  start: string;
  end: string;
}

export interface DateBoundaries {
  start: Date;
  end: Date;
}
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

function parseLocalDate(value: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;

  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

export function getCustomDateBoundaries(range: CustomDateRange): DateBoundaries | null {
  const start = parseLocalDate(range.start, false);
  const end = parseLocalDate(range.end, true);
  if (!start || !end || start > end) return null;
  return { start, end };
}

function toLocalDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultCustomDateRange(now = new Date()): CustomDateRange {
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  return { start: toLocalDateInputValue(start), end: toLocalDateInputValue(end) };
}

export function getPreviousDateBoundaries(range: DateBoundaries): DateBoundaries {
  const startDayUtc = Date.UTC(
    range.start.getFullYear(), range.start.getMonth(), range.start.getDate()
  );
  const endDayUtc = Date.UTC(
    range.end.getFullYear(), range.end.getMonth(), range.end.getDate()
  );
  const calendarDays = Math.round((endDayUtc - startDayUtc) / 86_400_000) + 1;

  const end = new Date(range.start);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - (calendarDays - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end };
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
  now = new Date(),
  customRange?: CustomDateRange
): boolean {
  if (periodo === 'todos') return true;

  const rawDate = referenceDate(createdAt, activity, dataReferencia);
  if (!rawDate) return false;

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return false;

  if (periodo === 'personalizado') {
    const range = customRange ? getCustomDateBoundaries(customRange) : null;
    return Boolean(range && date >= range.start && date <= range.end);
  }

  if (periodo === 'ontem') {
    return date >= startOfDaysAgo(now, 1) && date < startOfDaysAgo(now, 0);
  }

  const daysByPeriod: Record<Exclude<Periodo, 'ontem' | 'personalizado' | 'todos'>, number> = {
    hoje: 0,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };

  return date >= startOfDaysAgo(now, daysByPeriod[periodo]);
}
