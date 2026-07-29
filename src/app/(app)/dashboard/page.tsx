'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import type { BaseDeLeads } from '@/types/database';
import { deduplicateLeads, fetchAllLeads } from '@/lib/leads';
import { KpiCard } from '@/components/KpiCard';
import { PillFilter, type PillOption } from '@/components/PillFilter';
import { usePipelineEtapas } from '@/hooks/usePipelineEtapas';
import { etapaDe } from '@/lib/pipeline-etapas';
import { isDentroExpediente } from '@/lib/expediente';
import { sumCurrentNegotiationValue } from '@/lib/dashboard-metrics';

type Periodo = 'hoje' | 'ontem' | '7d' | '30d' | '90d';

const PERIODO_OPTIONS: PillOption<Periodo>[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

// Decisão de horário comercial fixo (não há configuração de expediente no banco hoje):

function getPeriodoRange(periodo: Periodo): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();

  switch (periodo) {
    case 'hoje': {
      const start = startOfDay(now);
      const end = endOfDay(now);
      const prevStart = startOfDay(subDays(now, 1));
      const prevEnd = endOfDay(subDays(now, 1));
      return { start, end, prevStart, prevEnd };
    }
    case 'ontem': {
      const start = startOfDay(subDays(now, 1));
      const end = endOfDay(subDays(now, 1));
      const prevStart = startOfDay(subDays(now, 2));
      const prevEnd = endOfDay(subDays(now, 2));
      return { start, end, prevStart, prevEnd };
    }
    case '7d': {
      const start = startOfDay(subDays(now, 6));
      const end = endOfDay(now);
      const prevStart = startOfDay(subDays(now, 13));
      const prevEnd = endOfDay(subDays(now, 7));
      return { start, end, prevStart, prevEnd };
    }
    case '30d': {
      const start = startOfDay(subDays(now, 29));
      const end = endOfDay(now);
      const prevStart = startOfDay(subDays(now, 59));
      const prevEnd = endOfDay(subDays(now, 30));
      return { start, end, prevStart, prevEnd };
    }
    case '90d': {
      const start = startOfDay(subDays(now, 89));
      const end = endOfDay(now);
      const prevStart = startOfDay(subDays(now, 179));
      const prevEnd = endOfDay(subDays(now, 90));
      return { start, end, prevStart, prevEnd };
    }
  }
}

const ORIGEM_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ef4444', '#38bdf8', '#6b7280'];

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<BaseDeLeads[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('7d');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { etapas } = usePipelineEtapas();

  useEffect(() => {
    let isMounted = true;

    async function fetchLeads() {
      setLoading(true);
      setLoadError(null);
      const supabase = createClient();
      try {
        const allLeads = await fetchAllLeads(async (from, to) => {
          const { data, error } = await supabase
            .from('BASE_DE_LEADS')
            .select(
              'id, id_empresa, nome_lead, telefone, email, origem, vendedor, veiculo_interesse, resumo_qualificacao, estagio_lead, resumo_comercial, created_at, updated_at, valor, observacao_vendedor, bot_ativo, bot_ativo_alterado_em, "Etapa", "QuemEnviouMsg", "UltimaMensagem", StatusDeFollow:"Status de Follow", "Transferencia", PesquisaDeSatisfacao:"Pesquisa de satisfação"'
            )
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);
          if (error) throw new Error(error.message);
          return (data as unknown as BaseDeLeads[]) ?? [];
        });
        if (!isMounted) return;
        const deduplicated = deduplicateLeads(allLeads);
        setLeads(deduplicated.leads);
        setDuplicateCount(deduplicated.duplicateCount);
      } catch (error) {
        if (!isMounted) return;
        console.error('Erro ao buscar leads:', error instanceof Error ? error.message : 'Erro desconhecido');
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o dashboard.');
        setLeads([]);
        setDuplicateCount(0);
      }

      setUpdatedAt(new Date());
      setLoading(false);
    }

    fetchLeads();

    return () => {
      isMounted = false;
    };
  }, []);

  const { start, end, prevStart, prevEnd } = useMemo(() => getPeriodoRange(periodo), [periodo]);

  const leadsNoPeriodo = useMemo(
    () =>
      leads.filter((lead) =>
        isWithinInterval(new Date(lead.created_at), { start, end })
      ),
    [leads, start, end]
  );

  const leadsPeriodoAnterior = useMemo(
    () =>
      leads.filter((lead) =>
        isWithinInterval(new Date(lead.created_at), { start: prevStart, end: prevEnd })
      ),
    [leads, prevStart, prevEnd]
  );

  const totalLeads = leadsNoPeriodo.length;
  const totalLeadsAnterior = leadsPeriodoAnterior.length;

  const fechados = leadsNoPeriodo.filter((l) => (l.estagio_lead ?? '').toLowerCase() === 'fechado').length;
  const fechadosAnterior = leadsPeriodoAnterior.filter(
    (l) => (l.estagio_lead ?? '').toLowerCase() === 'fechado'
  ).length;

  const taxaConversao = totalLeads > 0 ? (fechados / totalLeads) * 100 : 0;
  const taxaConversaoAnterior = totalLeadsAnterior > 0 ? (fechadosAnterior / totalLeadsAnterior) * 100 : 0;

  const valorEmNegociacao = sumCurrentNegotiationValue(leads);

  const agora = new Date();
  const dentroExpediente = isDentroExpediente(agora);
  const leadsDentroExpediente = leadsNoPeriodo.filter((l) => isDentroExpediente(new Date(l.created_at)));
  const pctDentroExpediente = totalLeads > 0 ? (leadsDentroExpediente.length / totalLeads) * 100 : 0;

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );

  // Tempo até atendimento: aproximação client-side usando UltimaMensagem - created_at quando
  // ambos disponíveis. Se não houver dados suficientes, retorna null e a UI mostra "Sem dados".
  const tempoMedioAtendimentoMin = useMemo(() => {
    const validos = leadsNoPeriodo.filter((l) => l.DataEHora);
    if (validos.length === 0) return null;
    const total = validos.reduce((sum, l) => {
      const criado = new Date(l.created_at).getTime();
      const atendido = new Date(l.DataEHora as string).getTime();
      const diffMin = Math.max(0, (atendido - criado) / 60000);
      return sum + diffMin;
    }, 0);
    return total / validos.length;
  }, [leadsNoPeriodo]);

  const entradaPorDia = useMemo(() => {
    const map = new Map<string, number>();
    leadsNoPeriodo.forEach((lead) => {
      const key = format(new Date(lead.created_at), 'dd/MM');
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([data, total]) => ({ data, total }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [leadsNoPeriodo]);

  const leadsPorVendedor = useMemo(() => {
    const map = new Map<string, number>();
    leadsNoPeriodo.forEach((lead) => {
      const key = lead.vendedor || 'Sem vendedor';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([vendedor, total]) => ({ vendedor, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [leadsNoPeriodo]);

  const origemDosLeads = useMemo(() => {
    const map = new Map<string, number>();
    leadsNoPeriodo.forEach((lead) => {
      const key = lead.origem || 'Não informado';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([origem, total]) => ({ origem, total }));
  }, [leadsNoPeriodo]);

  const leadsPorEstagio = useMemo(() => {
    const map = new Map<string, number>();
    leadsNoPeriodo.forEach((lead) => {
      const key = (lead.estagio_lead || 'desconhecido').toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([estagio, total]) => {
        const etapa = etapaDe(estagio, etapas);
        return {
          estagio,
          total,
          label: etapa?.nome ?? estagio,
          color: etapa?.cor ?? '#6b7280',
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [etapas, leadsNoPeriodo]);

  const veiculosMaisProcurados = useMemo(() => {
    const map = new Map<string, number>();
    leadsNoPeriodo.forEach((lead) => {
      if (!lead.veiculo_interesse) return;
      map.set(lead.veiculo_interesse, (map.get(lead.veiculo_interesse) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([veiculo, total]) => ({ veiculo, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [leadsNoPeriodo]);

  const maxVendedor = Math.max(1, ...leadsPorVendedor.map((v) => v.total));
  const maxEstagio = Math.max(1, ...leadsPorEstagio.map((v) => v.total));
  const maxVeiculo = Math.max(1, ...veiculosMaisProcurados.map((v) => v.total));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visão Geral de Leads</h1>
          <p className="text-xs text-gray-400">{duplicateCount} lead(s) duplicado(s) removido(s) da exibição.</p>
          {loadError && <p className="mt-1 text-xs text-red-600">Erro ao carregar dashboard: {loadError}</p>}
          <p className="text-sm text-gray-500">
            {format(start, "dd 'de' MMM", { locale: ptBR })} – {format(end, "dd 'de' MMM", { locale: ptBR })}
            {updatedAt && (
              <span className="ml-3 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                Atualizado {format(updatedAt, 'HH:mm')}
              </span>
            )}
          </p>
        </div>
        <PillFilter options={PERIODO_OPTIONS} selected={periodo} onChange={setPeriodo} />
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total de Leads"
              value={String(totalLeads)}
              variation={pctChange(totalLeads, totalLeadsAnterior)}
              dotColor="#3b82f6"
            />
            <KpiCard
              label="Taxa de Conversão"
              value={`${taxaConversao.toFixed(1)}%`}
              variation={pctChange(taxaConversao, taxaConversaoAnterior)}
              dotColor="#22c55e"
            />
            <KpiCard
              label="Valor em Negociação — carteira atual"
              value={currencyFormatter.format(valorEmNegociacao)}
              dotColor="#a855f7"
            >
              <p className="mt-1 text-xs text-gray-500">Todos os leads atualmente em negociação, independentemente da data de entrada.</p>
            </KpiCard>
            <KpiCard
              label="Expediente"
              value={dentroExpediente ? 'Dentro' : 'Fora'}
              dotColor={dentroExpediente ? '#22c55e' : '#ef4444'}
            >
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pctDentroExpediente.toFixed(0)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {pctDentroExpediente.toFixed(0)}% dos leads chegaram dentro do expediente (seg-sex, 8h-18h)
                </p>
              </div>
            </KpiCard>
          </div>

          <div className="rounded-xl bg-card p-5 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Tempo até Atendimento</h2>
            <p className="text-2xl font-bold text-foreground">
              {tempoMedioAtendimentoMin !== null ? `${tempoMedioAtendimentoMin.toFixed(0)} min` : 'Sem dados'}
            </p>
            <p className="text-xs text-gray-500">Tempo médio entre a criação do lead e a primeira resposta registrada</p>
          </div>

          <div className="rounded-xl bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Entrada de Leads</h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={entradaPorDia}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Leads por Vendedor</h2>
              <div className="space-y-3">
                {leadsPorVendedor.map((item) => (
                  <button
                    key={item.vendedor}
                    type="button"
                    className="block w-full text-left"
                    onClick={() => {
                      // Clique reservado para futura navegação filtrada por vendedor na tela de Leads.
                    }}
                  >
                    <div className="mb-1 flex justify-between text-xs text-gray-600">
                      <span>{item.vendedor}</span>
                      <span className="font-medium">{item.total}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${(item.total / maxVendedor) * 100}%` }}
                      />
                    </div>
                  </button>
                ))}
                {leadsPorVendedor.length === 0 && (
                  <p className="text-sm text-gray-400">Nenhum lead no período.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Origem dos Leads</h2>
              {origemDosLeads.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum lead no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={origemDosLeads}
                      dataKey="total"
                      nameKey="origem"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {origemDosLeads.map((_, index) => (
                        <Cell key={index} fill={ORIGEM_COLORS[index % ORIGEM_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Leads por Estágio</h2>
              <div className="space-y-3">
                {leadsPorEstagio.map((item) => (
                  <div key={item.estagio}>
                    <div className="mb-1 flex justify-between text-xs text-gray-600">
                      <span>{item.label}</span>
                      <span className="font-medium">{item.total}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(item.total / maxEstagio) * 100}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
                {leadsPorEstagio.length === 0 && (
                  <p className="text-sm text-gray-400">Nenhum lead no período.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Veículos Mais Procurados</h2>
              <div className="space-y-3">
                {veiculosMaisProcurados.map((item) => (
                  <div key={item.veiculo}>
                    <div className="mb-1 flex justify-between text-xs text-gray-600">
                      <span>{item.veiculo}</span>
                      <span className="font-medium">{item.total}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-orange-500"
                        style={{ width: `${(item.total / maxVeiculo) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {veiculosMaisProcurados.length === 0 && (
                  <p className="text-sm text-gray-400">Nenhum veículo de interesse registrado.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
