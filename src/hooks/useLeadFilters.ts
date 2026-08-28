import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BaseDeLeads, Etiqueta } from '@/types/database';
import { isDentroExpediente } from '@/lib/expediente';
import type { PillOption } from '@/components/PillFilter';
import {
  getDefaultCustomDateRange,
  isLeadWithinPeriod,
  type DataReferencia,
  type Periodo,
} from '@/lib/lead-period-filter';
import { useLeadActivityDates } from '@/hooks/useLeadActivityDates';

export type { DataReferencia, Periodo } from '@/lib/lead-period-filter';
export type Expediente = 'todos' | 'dentro' | 'fora';

export const SEM_VENDEDOR_FILTER_VALUE = 'sem-vendedor';

export function matchesVendedorFilter(vendedor: string | null, filtro: string): boolean {
  if (filtro === 'todos') return true;
  if (filtro === SEM_VENDEDOR_FILTER_VALUE) return !vendedor;
  return vendedor === filtro;
}

export const PERIODO_OPTIONS: PillOption<Periodo>[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'personalizado', label: 'Personalizado' },
  { value: 'todos', label: 'Todos' },
];

export const EXPEDIENTE_OPTIONS: PillOption<Expediente>[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'dentro', label: 'Dentro do expediente' },
  { value: 'fora', label: 'Fora do expediente' },
];

export function useLeadFilters(leads: BaseDeLeads[], enableActivityDates = false) {
  const [busca, setBusca] = useState('');
  const [origemFiltro, setOrigemFiltro] = useState('todas');
  const [vendedorFiltro, setVendedorFiltro] = useState('todos');
  const [veiculoFiltro, setVeiculoFiltro] = useState('todos');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState('todas');
  const [periodo, setPeriodo] = useState<Periodo>('todos');
  const [customStart, setCustomStart] = useState(() => getDefaultCustomDateRange().start);
  const [customEnd, setCustomEnd] = useState(() => getDefaultCustomDateRange().end);
  const [dataReferencia, setDataReferencia] = useState<DataReferencia>('criacao');
  const [expediente, setExpediente] = useState<Expediente>('todos');
  const [etiquetasDisponiveis, setEtiquetasDisponiveis] = useState<Etiqueta[]>([]);
  const [etiquetasPorLead, setEtiquetasPorLead] = useState<Map<number, Set<number>>>(new Map());
  const {
    atividadePorLead,
    activityLoading,
    activityLoaded,
    activityError,
    refreshActivityDates,
  } = useLeadActivityDates(enableActivityDates);

  const leadIds = useMemo(() => leads.map((lead) => lead.id), [leads]);
  const leadIdsKey = useMemo(() => leadIds.join(','), [leadIds]);

  const refreshEtiquetas = useCallback(async () => {
    const supabase = createClient();
    const { data: etiquetasData } = await supabase
      .from('etiquetas')
      .select('id, nome, cor, created_at')
      .order('nome');

    setEtiquetasDisponiveis((etiquetasData as Etiqueta[]) ?? []);

    if (leadIds.length === 0) {
      setEtiquetasPorLead(new Map());
      return;
    }

    const { data: vinculosData } = await supabase
      .from('lead_etiquetas')
      .select('id_lead, id_etiqueta')
      .in('id_lead', leadIds);

    const next = new Map<number, Set<number>>();
    ((vinculosData as { id_lead: number; id_etiqueta: number }[]) ?? []).forEach((vinculo) => {
      const etiquetas = next.get(vinculo.id_lead) ?? new Set<number>();
      etiquetas.add(vinculo.id_etiqueta);
      next.set(vinculo.id_lead, etiquetas);
    });
    setEtiquetasPorLead(next);
  }, [leadIds, leadIdsKey]);

  useEffect(() => {
    let isMounted = true;

    async function fetchEtiquetas() {
      const supabase = createClient();
      const { data: etiquetasData } = await supabase
        .from('etiquetas')
        .select('id, nome, cor, created_at')
        .order('nome');

      if (!isMounted) return;
      setEtiquetasDisponiveis((etiquetasData as Etiqueta[]) ?? []);

      if (leadIds.length === 0) {
        setEtiquetasPorLead(new Map());
        return;
      }

      const { data: vinculosData } = await supabase
        .from('lead_etiquetas')
        .select('id_lead, id_etiqueta')
        .in('id_lead', leadIds);

      if (!isMounted) return;
      const next = new Map<number, Set<number>>();
      ((vinculosData as { id_lead: number; id_etiqueta: number }[]) ?? []).forEach((vinculo) => {
        const etiquetas = next.get(vinculo.id_lead) ?? new Set<number>();
        etiquetas.add(vinculo.id_etiqueta);
        next.set(vinculo.id_lead, etiquetas);
      });
      setEtiquetasPorLead(next);
    }

    fetchEtiquetas();

    function handleLeadEtiquetasUpdated() {
      refreshEtiquetas();
    }

    window.addEventListener('lead-etiquetas-updated', handleLeadEtiquetasUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener('lead-etiquetas-updated', handleLeadEtiquetasUpdated);
    };
  }, [leadIds, leadIdsKey, refreshEtiquetas]);

  const origensDisponiveis = useMemo(
    () => Array.from(new Set(leads.map((l) => l.origem).filter((v): v is string => Boolean(v)))),
    [leads]
  );

  const vendedoresDisponiveis = useMemo(
    () => Array.from(new Set(leads.map((l) => l.vendedor).filter((v): v is string => Boolean(v)))),
    [leads]
  );

  const veiculosDisponiveis = useMemo(
    () =>
      Array.from(new Set(leads.map((l) => l.veiculo_interesse).filter((v): v is string => Boolean(v)))),
    [leads]
  );

  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      if (busca) {
        const term = busca.toLowerCase();
        const matches =
          lead.nome_lead?.toLowerCase().includes(term) ||
          lead.telefone?.toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term);
        if (!matches) return false;
      }

      if (origemFiltro !== 'todas' && lead.origem !== origemFiltro) return false;
      if (!matchesVendedorFilter(lead.vendedor, vendedorFiltro)) return false;
      if (veiculoFiltro !== 'todos' && lead.veiculo_interesse !== veiculoFiltro) return false;

      if (etiquetaFiltro !== 'todas') {
        const idEtiqueta = Number(etiquetaFiltro);
        if (!etiquetasPorLead.get(lead.id)?.has(idEtiqueta)) return false;
      }

      if (!isLeadWithinPeriod(
        lead.created_at,
        atividadePorLead.get(lead.id),
        periodo,
        dataReferencia,
        new Date(),
        { start: customStart, end: customEnd }
      )) return false;

      if (expediente !== 'todos') {
        const dentro = isDentroExpediente(new Date(lead.created_at));
        if (expediente === 'dentro' && !dentro) return false;
        if (expediente === 'fora' && dentro) return false;
      }

      return true;
    });
  }, [
    leads,
    busca,
    origemFiltro,
    vendedorFiltro,
    veiculoFiltro,
    etiquetaFiltro,
    etiquetasPorLead,
    periodo,
    customStart,
    customEnd,
    dataReferencia,
    atividadePorLead,
    expediente,
  ]);

  function limparFiltros() {
    setBusca('');
    setOrigemFiltro('todas');
    setVendedorFiltro('todos');
    setVeiculoFiltro('todos');
    setEtiquetaFiltro('todas');
    setPeriodo('todos');
    const defaultCustomRange = getDefaultCustomDateRange();
    setCustomStart(defaultCustomRange.start);
    setCustomEnd(defaultCustomRange.end);
    setDataReferencia('criacao');
    setExpediente('todos');
  }

  return {
    busca,
    setBusca,
    origemFiltro,
    setOrigemFiltro,
    vendedorFiltro,
    setVendedorFiltro,
    veiculoFiltro,
    setVeiculoFiltro,
    etiquetaFiltro,
    setEtiquetaFiltro,
    periodo,
    setPeriodo,
    customStart,
    customEnd,
    setCustomStart,
    setCustomEnd,
    dataReferencia,
    setDataReferencia,
    activityLoading,
    activityLoaded,
    activityError,
    expediente,
    setExpediente,
    origensDisponiveis,
    vendedoresDisponiveis,
    veiculosDisponiveis,
    etiquetasDisponiveis,
    etiquetasPorLead,
    leadsFiltrados,
    limparFiltros,
    refreshEtiquetas,
    refreshActivityDates,
  };
}

export type LeadFiltersState = ReturnType<typeof useLeadFilters>;
