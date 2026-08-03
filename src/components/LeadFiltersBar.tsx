'use client';

import { useMemo, useState } from 'react';
import { PillFilter } from '@/components/PillFilter';
import {
  EXPEDIENTE_OPTIONS,
  PERIODO_OPTIONS,
  type LeadFiltersState,
} from '@/hooks/useLeadFilters';
import { DATA_REFERENCIA_OPTIONS } from '@/lib/lead-period-filter';

interface LeadFiltersBarProps {
  filters: LeadFiltersState;
  showDataReference?: boolean;
}

export function LeadFiltersBar({ filters, showDataReference = false }: LeadFiltersBarProps) {
  const [etiquetasOpen, setEtiquetasOpen] = useState(false);
  const etiquetaSelecionada = useMemo(
    () =>
      filters.etiquetasDisponiveis.find((etiqueta) => String(etiqueta.id) === filters.etiquetaFiltro) ??
      null,
    [filters.etiquetaFiltro, filters.etiquetasDisponiveis]
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-4 shadow-sm">
      <input
        type="text"
        placeholder="Buscar por nome, telefone ou e-mail..."
        value={filters.busca}
        onChange={(e) => filters.setBusca(e.target.value)}
        className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
      />

      <select
        value={filters.origemFiltro}
        onChange={(e) => filters.setOrigemFiltro(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="todas">Todas as origens</option>
        {filters.origensDisponiveis.map((origem) => (
          <option key={origem} value={origem}>
            {origem}
          </option>
        ))}
      </select>

      <select
        value={filters.vendedorFiltro}
        onChange={(e) => filters.setVendedorFiltro(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="todos">Todos os vendedores</option>
        {filters.vendedoresDisponiveis.map((vendedor) => (
          <option key={vendedor} value={vendedor}>
            {vendedor}
          </option>
        ))}
      </select>

      <select
        value={filters.veiculoFiltro}
        onChange={(e) => filters.setVeiculoFiltro(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="todos">Todos os veículos</option>
        {filters.veiculosDisponiveis.map((veiculo) => (
          <option key={veiculo} value={veiculo}>
            {veiculo}
          </option>
        ))}
      </select>

      <div className="relative">
        <button
          type="button"
          onClick={() => setEtiquetasOpen((open) => !open)}
          className="flex min-w-[190px] items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: etiquetaSelecionada?.cor ?? '#d1d5db' }}
            />
            <span className="truncate">{etiquetaSelecionada?.nome ?? 'Todas as etiquetas'}</span>
          </span>
          <span className="text-xs text-gray-400">v</span>
        </button>

        {etiquetasOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full min-w-[220px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                filters.setEtiquetaFiltro('todas');
                setEtiquetasOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
              Todas as etiquetas
            </button>

            {filters.etiquetasDisponiveis.map((etiqueta) => (
              <button
                key={etiqueta.id}
                type="button"
                onClick={() => {
                  filters.setEtiquetaFiltro(String(etiqueta.id));
                  setEtiquetasOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: etiqueta.cor }} />
                <span className="truncate">{etiqueta.nome}</span>
              </button>
            ))}

            {filters.etiquetasDisponiveis.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">Nenhuma etiqueta cadastrada.</p>
            )}
          </div>
        )}
      </div>

      {showDataReference && (
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="whitespace-nowrap">Data considerada</span>
          <select
            value={filters.dataReferencia}
            onChange={(event) => filters.setDataReferencia(event.target.value as typeof filters.dataReferencia)}
            disabled={(filters.activityLoading || Boolean(filters.activityError)) && !filters.activityLoaded}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            {DATA_REFERENCIA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {filters.activityLoading && <span className="text-xs text-gray-400">Carregando atividades...</span>}
          {filters.activityError && (
            <button
              type="button"
              onClick={() => void filters.refreshActivityDates()}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Falha ao carregar — tentar novamente
            </button>
          )}
        </label>
      )}

      <PillFilter options={PERIODO_OPTIONS} selected={filters.periodo} onChange={filters.setPeriodo} />
      <PillFilter
        options={EXPEDIENTE_OPTIONS}
        selected={filters.expediente}
        onChange={filters.setExpediente}
      />

      <button
        type="button"
        onClick={filters.limparFiltros}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
      >
        Limpar filtros
      </button>
    </div>
  );
}
