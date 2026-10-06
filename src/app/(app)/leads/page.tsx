'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createClient } from '@/lib/supabase/client';
import type { BaseDeLeads } from '@/types/database';
import { Avatar } from '@/components/Avatar';
import { StatusBadge } from '@/components/StatusBadge';
import { LeadFiltersBar } from '@/components/LeadFiltersBar';
import { NovoLeadModal } from '@/components/NovoLeadModal';
import { LeadDrawer } from '@/components/LeadDrawer';
import { AutomotiveLoading } from '@/components/AutomotiveLoading';
import { useLeadFilters } from '@/hooks/useLeadFilters';
import { deduplicateLeads, fetchAllLeads } from '@/lib/leads';
import { usePipelineEtapas } from '@/hooks/usePipelineEtapas';
import { etapaDe } from '@/lib/pipeline-etapas';

const ORIGEM_DOT_COLORS: Record<string, string> = {
  whatsapp: '#22c55e',
  instagram: '#a855f7',
  facebook: '#3b82f6',
  site: '#38bdf8',
  indicacao: '#f97316',
};

function getOrigemColor(origem: string | null): string {
  if (!origem) return '#6b7280';
  return ORIGEM_DOT_COLORS[origem.toLowerCase()] ?? '#6b7280';
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<BaseDeLeads[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNovoLeadAberto, setModalNovoLeadAberto] = useState(false);
  const [leadSelecionado, setLeadSelecionado] = useState<BaseDeLeads | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leadsSelecionados, setLeadsSelecionados] = useState<Set<number>>(() => new Set());
  const [podeRedistribuir, setPodeRedistribuir] = useState(false);
  const [redistribuindo, setRedistribuindo] = useState(false);
  const [mensagemRedistribuicao, setMensagemRedistribuicao] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);
  const selecionarTodosRef = useRef<HTMLInputElement>(null);
  const { etapas } = usePipelineEtapas();
  const filters = useLeadFilters(leads);
  const { leadsFiltrados } = filters;

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
              'id, id_empresa, nome_lead, telefone, email, origem, vendedor, veiculo_interesse, resumo_qualificacao, estagio_lead, resumo_comercial, created_at, updated_at, valor, observacao_vendedor, bot_ativo, bot_ativo_alterado_em, "Etapa", "QuemEnviouMsg", "UltimaMensagem", StatusDeFollow:"Status de Follow", "Transferencia", PesquisaDeSatisfacao:"Pesquisa de satisfação", cpf, data_nascimento, score_serasa'
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
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os leads.');
        setLeads([]);
        setDuplicateCount(0);
      }
      setLoading(false);
    }

    fetchLeads();
    const refresh = () => void fetchLeads();
    window.addEventListener('lead-assignments-changed', refresh);
    return () => {
      isMounted = false;
      window.removeEventListener('lead-assignments-changed', refresh);
    };
  }, []);

  useEffect(() => {
    async function carregarPermissao() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase.from('profiles').select('cargo').eq('id', auth.user.id).single();
      setPodeRedistribuir(['admin_master', 'admin', 'gerente'].includes((data as { cargo?: string } | null)?.cargo ?? ''));
    }
    void carregarPermissao();
  }, []);

  const todosFiltradosSelecionados = leadsFiltrados.length > 0 && leadsFiltrados.every((lead) => leadsSelecionados.has(lead.id));
  const algunsFiltradosSelecionados = leadsFiltrados.some((lead) => leadsSelecionados.has(lead.id));

  useEffect(() => {
    if (selecionarTodosRef.current) selecionarTodosRef.current.indeterminate = algunsFiltradosSelecionados && !todosFiltradosSelecionados;
  }, [algunsFiltradosSelecionados, todosFiltradosSelecionados]);

  function alternarLeadSelecionado(leadId: number) {
    setLeadsSelecionados((atuais) => {
      const proximos = new Set(atuais);
      proximos.has(leadId) ? proximos.delete(leadId) : proximos.add(leadId);
      return proximos;
    });
  }

  function alternarTodosFiltrados() {
    setLeadsSelecionados((atuais) => {
      const proximos = new Set(atuais);
      leadsFiltrados.forEach((lead) => todosFiltradosSelecionados ? proximos.delete(lead.id) : proximos.add(lead.id));
      return proximos;
    });
  }

  async function redistribuirSelecionados() {
    if (leadsSelecionados.size === 0 || redistribuindo) return;
    const ids = [...leadsSelecionados];
    if (!window.confirm(`Redistribuir igualmente ${ids.length} lead(s) entre todos os vendedores ativos?`)) return;
    setRedistribuindo(true);
    setMensagemRedistribuicao(null);
    const { data, error } = await createClient().rpc('redistribuir_leads', { p_lead_ids: ids });
    if (error) {
      setMensagemRedistribuicao({ tipo: 'erro', texto: error.message });
      setRedistribuindo(false);
      return;
    }
    const assignments = (data ?? []) as Array<{ lead_id: number; vendedor: string }>;
    const sellerByLead = new Map(assignments.map((item) => [Number(item.lead_id), item.vendedor]));
    setLeads((atuais) => atuais.map((lead) => sellerByLead.has(lead.id) ? { ...lead, vendedor: sellerByLead.get(lead.id)! } : lead));
    setLeadsSelecionados(new Set());
    setMensagemRedistribuicao({ tipo: 'sucesso', texto: `${assignments.length} lead(s) redistribuído(s) com sucesso.` });
    setRedistribuindo(false);
    window.dispatchEvent(new Event('lead-assignments-changed'));
  }

  function exportarCsv() {
    const headers = ['Nome', 'Telefone', 'Email', 'Origem', 'Vendedor', 'Veículo', 'Estágio', 'Valor', 'Criado em'];
    const rows = leadsFiltrados.map((l) => [
      l.nome_lead,
      l.telefone,
      l.email ?? '',
      l.origem ?? '',
      l.vendedor ?? '',
      l.veiculo_interesse ?? '',
      l.estagio_lead,
      l.valor ?? '',
      l.created_at,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 64;

  const rowVirtualizer = useVirtualizer({
    count: leadsFiltrados.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-gray-500">{leadsFiltrados.length} lead(s) encontrado(s)</p>
          <p className="text-xs text-gray-400">{duplicateCount} lead(s) duplicado(s) removido(s) da exibição.</p>
          {loadError && <p className="mt-1 text-xs text-red-600">Erro ao carregar leads: {loadError}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalNovoLeadAberto(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Novo lead
          </button>
          <button
            type="button"
            onClick={exportarCsv}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <LeadFiltersBar filters={filters} />

      {podeRedistribuir && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-card p-3 shadow-sm dark:border-gray-700">
          <button type="button" onClick={alternarTodosFiltrados} disabled={leadsFiltrados.length === 0 || redistribuindo} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            {todosFiltradosSelecionados ? 'Desmarcar filtrados' : 'Selecionar todos os filtrados'}
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300">{leadsSelecionados.size} selecionado(s)</span>
          <button type="button" onClick={() => void redistribuirSelecionados()} disabled={leadsSelecionados.size === 0 || redistribuindo} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {redistribuindo ? 'Redistribuindo...' : 'Redistribuir igualmente'}
          </button>
          {leadsSelecionados.size > 0 && <button type="button" onClick={() => setLeadsSelecionados(new Set())} disabled={redistribuindo} className="text-sm text-gray-500 hover:text-foreground">Limpar seleção</button>}
          {mensagemRedistribuicao && <p role="status" className={`w-full text-sm ${mensagemRedistribuicao.tipo === 'sucesso' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{mensagemRedistribuicao.texto}</p>}
        </div>
      )}

      <div className="rounded-xl bg-card shadow-sm">
        <div className="grid grid-cols-[32px_1.5fr_1fr_1fr_1fr_1fr_0.8fr] gap-2 border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <input ref={selecionarTodosRef} type="checkbox" checked={todosFiltradosSelecionados} onChange={alternarTodosFiltrados} disabled={!podeRedistribuir || leadsFiltrados.length === 0} aria-label="Selecionar todos os leads filtrados" className="h-4 w-4 accent-primary disabled:invisible" />
          <span>Lead</span>
          <span>Origem</span>
          <span>Vendedor</span>
          <span>Veículo</span>
          <span>Estágio</span>
          <span>Valor</span>
        </div>

        {loading ? (
          <AutomotiveLoading label="Carregando leads" />
        ) : leadsFiltrados.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Nenhum lead encontrado.</p>
        ) : (
          <div ref={parentRef} className="max-h-[600px] overflow-y-auto">
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const lead = leadsFiltrados[virtualRow.index];
                return (
                  <div
                    key={lead.id}
                    onClick={() => setLeadSelecionado(lead)}
                    className={`absolute left-0 top-0 grid w-full cursor-pointer grid-cols-[32px_1.5fr_1fr_1fr_1fr_1fr_0.8fr] items-center gap-2 border-b border-gray-100 px-4 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60 ${leadsSelecionados.has(lead.id) ? 'bg-primary/5' : ''}`}
                    style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <input type="checkbox" checked={leadsSelecionados.has(lead.id)} onClick={(event) => event.stopPropagation()} onChange={() => alternarLeadSelecionado(lead.id)} disabled={!podeRedistribuir} aria-label={`Selecionar ${lead.nome_lead}`} className="h-4 w-4 accent-primary disabled:invisible" />
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Avatar name={lead.nome_lead} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{lead.nome_lead}</p>
                        <p className="truncate text-xs text-gray-500">
                          {lead.telefone} ·{' '}
                          {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getOrigemColor(lead.origem) }}
                      />
                      {lead.origem ?? '—'}
                    </div>
                    <span className="truncate text-sm text-gray-700">{lead.vendedor ?? '—'}</span>
                    <span className="truncate text-sm text-gray-700">{lead.veiculo_interesse ?? '—'}</span>
                    <StatusBadge estagio={lead.estagio_lead} etapas={etapas} />
                    <span className="text-sm font-medium text-foreground">
                      {lead.valor != null ? currencyFormatter.format(lead.valor) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {modalNovoLeadAberto && (
        <NovoLeadModal
          onClose={() => setModalNovoLeadAberto(false)}
          onCreated={(novoLead) => {
            setLeads((prev) => [novoLead, ...prev]);
            setModalNovoLeadAberto(false);
          }}
        />
      )}

      {leadSelecionado && (
        <LeadDrawer
          lead={leadSelecionado}
          estagioLabel={etapaDe(leadSelecionado.estagio_lead, etapas).nome}
          estagioColor={etapaDe(leadSelecionado.estagio_lead, etapas).cor}
          estagioLabelOf={(estagio) => etapaDe(estagio, etapas).nome}
          onClose={() => setLeadSelecionado(null)}
          onUpdated={(atualizado) => {
            setLeadSelecionado(atualizado);
            setLeads((prev) => prev.map((l) => (l.id === atualizado.id ? atualizado : l)));
          }}
          onDeleted={(leadId) => {
            setLeads((leadsAtuais) => leadsAtuais.filter((l) => l.id !== leadId));
            setLeadSelecionado(null);
          }}
        />
      )}
    </div>
  );
}
