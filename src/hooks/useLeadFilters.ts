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
import { activeSellerNames, type SellerAvailability } from '@/lib/active-sellers';

export type { DataReferencia, Periodo } from '@/lib/lead-period-filter';
export type Expediente = 'todos' | 'dentro' | 'fora';
export type VendedorStatus = 'todos' | 'ativos' | 'inativos';

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

export const VENDEDOR_STATUS_OPTIONS: PillOption<VendedorStatus>[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativos', label: 'Ativos' },
  { value: 'inativos', label: 'Inativos' },
];

export function useLeadFilters(leads: BaseDeLeads[], enableActivityDates = false) {
  const [busca, setBusca] = useState('');
  const [origemFiltro, setOrigemFiltro] = useState('todas');
  const [vendedorFiltro, setVendedorFiltro] = useState('todos');
  const [vendedorStatusFiltro, setVendedorStatusFiltro] = useState<VendedorStatus>('todos');
  const [veiculoFiltro, setVeiculoFiltro] = useState('todos');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState('todas');
  const [periodo, setPeriodo] = useState<Periodo>('todos');
  const [customStart, setCustomStart] = useState(() => getDefaultCustomDateRange().start);
  const [customEnd, setCustomEnd] = useState(() => getDefaultCustomDateRange().end);
  const [dataReferencia, setDataReferencia] = useState<DataReferencia>('criacao');
  const [expediente, setExpediente] = useState<Expediente>('todos');
  const [etiquetasDisponiveis, setEtiquetasDisponiveis] = useState<Etiqueta[]>([]);
  const [etiquetasPorLead, setEtiquetasPorLead] = useState<Map<number, Set<number>>>(new Map());
  // Nomes de vendedores ativos na tabela VENDEDORES (fonte de verdade)
  const [vendedoresAtivos, setVendedoresAtivos] = useState<string[]>([]);
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

  useEffect(() => {
    let isMounted = true;

    async function fetchVendedoresAtivos() {
      const { data, error } = await createClient()
        .from('VENDEDORES')
        .select('vendedor, ativo')
        .eq('ativo', true)
        .order('vendedor');

      if (!isMounted) return;
      setVendedoresAtivos(error ? [] : activeSellerNames((data as SellerAvailability[]) ?? []));
    }

    void fetchVendedoresAtivos();
    const refresh = () => void fetchVendedoresAtivos();
    window.addEventListener('seller-availability-changed', refresh);
    return () => {
      isMounted = false;
      window.removeEventListener('seller-availability-changed', refresh);
    };
  }, []);

  const origensDisponiveis = useMemo(
    () => Array.from(new Set(leads.map((l) => l.origem).filter((v): v is string => Boolean(v)))),
    [leads]
  );

  const veiculosDisponiveis = useMemo(
    () =>
      Array.from(new Set(leads.map((l) => l.veiculo_interesse).filter((v): v is string => Boolean(v)))),
    [leads]
  );

  // Conjunto de nomes ativos para lookups O(1)
  const vendedoresAtivosSet = useMemo(() => new Set(vendedoresAtivos), [vendedoresAtivos]);

  // Vendedores inativos: aparecem em algum lead mas não estão na lista de ativos
  const vendedoresInativos = useMemo(() => {
    const nomesNosLeads = leads
      .map((l) => l.vendedor?.trim())
      .filter((v): v is string => Boolean(v) && !vendedoresAtivosSet.has(v as string));
    return [...new Set(nomesNosLeads)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [leads, vendedoresAtivosSet]);

  // Lista de vendedores exibida no dropdown — restrita ao status selecionado
  const vendedoresDisponiveis = useMemo(() => {
    if (vendedorStatusFiltro === 'ativos') return vendedoresAtivos;
    if (vendedorStatusFiltro === 'inativos') return vendedoresInativos;
    // 'todos': ativos + inativos ordenados
    return [...new Set([...vendedoresAtivos, ...vendedoresInativos])].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
  }, [vendedorStatusFiltro, vendedoresAtivos, vendedoresInativos]);

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

      // Filtro de status do vendedor (ativo / inativo)
      if (vendedorStatusFiltro !== 'todos') {
        const nomeVendedor = lead.vendedor?.trim();
        const eAtivo = nomeVendedor ? vendedoresAtivosSet.has(nomeVendedor) : false;
        if (vendedorStatusFiltro === 'ativos' && !eAtivo) return false;
        if (vendedorStatusFiltro === 'inativos' && (eAtivo || !nomeVendedor)) return false;
      }

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
    vendedorStatusFiltro,
    vendedoresAtivosSet,
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
    setVendedorStatusFiltro('todos');
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
    vendedorStatusFiltro,
    setVendedorStatusFiltro,
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
    vendedoresInativos,
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
