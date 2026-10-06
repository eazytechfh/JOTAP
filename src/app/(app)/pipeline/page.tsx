'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createClient } from '@/lib/supabase/client';
import type { BaseDeLeads, PipelineEtapa } from '@/types/database';
import { deduplicateLeads, fetchAllLeads } from '@/lib/leads';
import { Avatar } from '@/components/Avatar';
import { LeadDrawer } from '@/components/LeadDrawer';
import { LeadFiltersBar } from '@/components/LeadFiltersBar';
import { useLeadFilters } from '@/hooks/useLeadFilters';
import { usePipelineEtapas } from '@/hooks/usePipelineEtapas';
import { AutomotiveLoading } from '@/components/AutomotiveLoading';
import { SaleCelebration } from '@/components/SaleCelebration';

type VeiculoVenda = {
  id: number;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  placa: string | null;
  status: string | null;
};

function normalizarTexto(value: string | null | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function descricaoVeiculo(veiculo: VeiculoVenda) {
  return [veiculo.marca, veiculo.modelo, veiculo.ano, veiculo.placa].filter(Boolean).join(' · ');
}

function VendaFechadaModal({ lead, onCancel, onConfirm }: {
  lead: BaseDeLeads;
  onCancel: () => void;
  onConfirm: (nome: string, valor: number, veiculoId: number) => Promise<boolean>;
}) {
  const [nome, setNome] = useState(lead.nome_lead ?? '');
  const [valor, setValor] = useState(lead.valor ? String(lead.valor) : '');
  const [vehicles, setVehicles] = useState<VeiculoVenda[]>([]);
  const [veiculoId, setVeiculoId] = useState<number | null>(null);
  const [buscaVeiculo, setBuscaVeiculo] = useState('');
  const [listaAberta, setListaAberta] = useState(false);
  const [carregandoVeiculos, setCarregandoVeiculos] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const numero = Number(valor.replace(',', '.'));
  const valido = Boolean(nome.trim()) && Number.isFinite(numero) && numero > 0 && veiculoId !== null;
  const filteredVehicles = useMemo(() => {
    const termo = normalizarTexto(buscaVeiculo);
    return vehicles.filter((veiculo) => !termo || normalizarTexto(descricaoVeiculo(veiculo)).includes(termo));
  }, [buscaVeiculo, vehicles]);

  useEffect(() => {
    let ativo = true;
    async function carregarVeiculos() {
      const { data, error } = await createClient()
        .from('estoque')
        .select('id, marca, modelo, ano, placa, status')
        .order('marca', { ascending: true });
      if (!ativo) return;
      if (error) setErro('Não foi possível carregar os veículos disponíveis.');
      else setVehicles(((data ?? []) as VeiculoVenda[]).filter(
        (veiculo) => normalizarTexto(veiculo.status) === 'disponivel'
      ));
      setCarregandoVeiculos(false);
    }
    void carregarVeiculos();
    return () => { ativo = false; };
  }, []);

  async function confirmar() {
    if (!valido || veiculoId === null) return;
    setSalvando(true);
    setErro(null);
    const sucesso = await onConfirm(nome.trim(), numero, veiculoId);
    if (!sucesso) setErro('Não foi possível fechar a venda. O veículo pode não estar mais disponível.');
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold">Complete os dados da venda</h2>
        <p className="mt-1 text-sm text-gray-500">Nome, valor e veículo vendido são obrigatórios.</p>
        <label className="mt-5 block text-sm font-medium">Nome do lead</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
        <label className="mt-4 block text-sm font-medium">Valor da venda</label>
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2" />
        <label className="mt-4 block text-sm font-medium">Veículo vendido</label>
        <div className="relative mt-1">
          <input
            value={buscaVeiculo}
            onChange={(event) => {
              setBuscaVeiculo(event.target.value);
              setVeiculoId(null);
              setListaAberta(true);
            }}
            onFocus={() => setListaAberta(true)}
            placeholder="Digite marca, modelo, ano ou placa"
            role="combobox"
            aria-expanded={listaAberta}
            aria-controls="veiculos-venda-lista"
            className="w-full rounded-lg border px-3 py-2"
          />
          {listaAberta && (
            <div id="veiculos-venda-lista" role="listbox" className="absolute left-0 right-0 top-full z-[110] mt-1 max-h-60 overflow-y-auto rounded-lg border bg-white py-1 shadow-xl">
              {carregandoVeiculos && <p className="px-3 py-2 text-sm text-gray-500">Carregando veículos...</p>}
              {!carregandoVeiculos && filteredVehicles.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-500">Nenhum veículo disponível encontrado.</p>
              )}
              {filteredVehicles.map((veiculo) => (
                <button
                  key={veiculo.id}
                  type="button"
                  role="option"
                  aria-selected={veiculo.id === veiculoId}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setVeiculoId(veiculo.id);
                    setBuscaVeiculo(descricaoVeiculo(veiculo));
                    setListaAberta(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-primary/10"
                >
                  {descricaoVeiculo(veiculo)}
                </button>
              ))}
            </div>
          )}
        </div>
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={salvando} onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button>
          <button type="button" disabled={!valido || salvando} onClick={() => void confirmar()} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-40">
            {salvando ? 'Confirmando...' : 'Confirmar venda'}
          </button>
        </div>
      </div>
    </div>
  );
}

// A lista configurada no banco substitui o antigo conjunto fixo de colunas.
function normalizeEstagio(estagio: string, etapas: PipelineEtapa[]): string {
  const key = estagio.toLowerCase().trim();
  const found = etapas.find((etapa) => etapa.id === key);
  return found?.id ?? etapas[0]?.id ?? 'oportunidade';
}

interface CardProps {
  lead: BaseDeLeads;
  onOpen: (lead: BaseDeLeads) => void;
}

function LeadCard({ lead, onOpen }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead)}
      className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm active:cursor-grabbing"
    >
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={lead.nome_lead} size={28} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{lead.nome_lead}</p>
          <p className="truncate text-xs text-gray-500">{lead.telefone}</p>
        </div>
      </div>
      {lead.veiculo_interesse && (
        <p className="truncate text-xs text-gray-600">Interesse: {lead.veiculo_interesse}</p>
      )}
      {lead.vendedor && <p className="truncate text-xs text-gray-400">Vendedor: {lead.vendedor}</p>}
    </div>
  );
}

interface ColumnProps {
  id: string;
  label: string;
  color: string;
  leads: BaseDeLeads[];
  onOpenLead: (lead: BaseDeLeads) => void;
}

const LEADS_POR_PAGINA = 8;

function Column({ id, label, color, leads, onOpenLead }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [pagina, setPagina] = useState(1);

  // Volta pra primeira página sempre que o conjunto de leads da coluna muda (filtro aplicado,
  // lead movido pra dentro/fora etc.), pra não deixar a paginação "presa" numa página vazia.
  useEffect(() => {
    setPagina(1);
  }, [leads.length]);

  const totalPaginas = Math.max(1, Math.ceil(leads.length / LEADS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const leadsDaPagina = leads.slice(
    (paginaAtual - 1) * LEADS_POR_PAGINA,
    paginaAtual * LEADS_POR_PAGINA
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden rounded-xl bg-gray-50 p-3 ${
        isOver ? 'ring-2 ring-gray-400' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-gray-800">{label}</span>
        </div>
        <span className="text-xs text-gray-500">{leads.length}</span>
      </div>

      <SortableContext items={leadsDaPagina.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {leadsDaPagina.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onOpen={onOpenLead}
            />
          ))}
        </div>
      </SortableContext>

      {totalPaginas > 1 && (
        <div className="mt-3 flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={paginaAtual === 1}
            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-500">
            {paginaAtual} / {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={paginaAtual === totalPaginas}
            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<BaseDeLeads[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leadSelecionado, setLeadSelecionado] = useState<BaseDeLeads | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState<string>('Usuário');
  const filters = useLeadFilters(leads, true);
  const { leadsFiltrados, refreshActivityDates } = filters;
  const [vendaPendente, setVendaPendente] = useState<BaseDeLeads | null>(null);
  const [celebracao, setCelebracao] = useState<string | null>(null);
  const { etapas, erroEtapas } = usePipelineEtapas();
  const colunas = useMemo(
    () => etapas.map((etapa) => ({ id: etapa.id, label: etapa.nome, color: etapa.cor })),
    [etapas]
  );
  const fecharCelebracao = useCallback(() => setCelebracao(null), []);

  useEffect(() => {
    async function fetchUsuario() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, email')
        .eq('id', userData.user.id)
        .single();
      const nome = (profile as { nome: string | null; email: string | null } | null)?.nome;
      setNomeUsuario(nome || userData.user.email || 'Usuário');
    }
    fetchUsuario();
  }, []);

  // activationConstraint com distance pequena: faz o drag iniciar quase imediatamente ao
  // mover o mouse, dando resposta "rápida" ao usuário sem disparar drag acidental em cliques.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

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
              'id, id_empresa, nome_lead, telefone, email, origem, vendedor, veiculo_interesse, resumo_qualificacao, estagio_lead, resumo_comercial, created_at, updated_at, valor, observacao_vendedor, bot_ativo, bot_ativo_alterado_em, "Etapa", "QuemEnviouMsg", "UltimaMensagem", StatusDeFollow:"Status de Follow", "Transferencia", PesquisaDeSatisfacao:"Pesquisa de satisfação", cpf, data_nascimento, score_serasa, follow_manual'
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
        setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o pipeline.');
        setLeads([]);
        setDuplicateCount(0);
      }
      setLoading(false);
    }

    fetchLeads();
    const refresh = () => {
      void (async () => {
        await fetchLeads();
        await refreshActivityDates();
      })();
    };
    window.addEventListener('lead-assignments-changed', refresh);
    return () => {
      isMounted = false;
      window.removeEventListener('lead-assignments-changed', refresh);
    };
  }, [refreshActivityDates]);

  const leadsPorColuna = useMemo(() => {
    const map = new Map<string, BaseDeLeads[]>(colunas.map((c) => [c.id, []]));
    leadsFiltrados.forEach((lead) => {
      const coluna = normalizeEstagio(lead.estagio_lead, etapas);
      map.get(coluna)?.push(lead);
    });
    return map;
  }, [colunas, etapas, leadsFiltrados]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = Number(active.id);
    const overId = over.id;
    const colunaDireta = colunas.find((c) => c.id === overId)?.id;
    const leadDestino = leads.find((l) => l.id === Number(overId));
    const novoEstagio = colunaDireta ?? (leadDestino ? normalizeEstagio(leadDestino.estagio_lead, etapas) : null);
    if (!novoEstagio) return;

    const leadAtual = leads.find((l) => l.id === leadId);
    if (!leadAtual) return;
    if (novoEstagio === 'fechado') {
      setVendaPendente(leadAtual);
      return;
    }

    const estagioAnterior = leadAtual.estagio_lead;
    if (normalizeEstagio(estagioAnterior, etapas) === novoEstagio) return;

    const entrandoEmFollowUp = novoEstagio === 'follow_up';
    const saindoDeFollowUp = normalizeEstagio(estagioAnterior, etapas) === 'follow_up' && !entrandoEmFollowUp;
    const followManual = entrandoEmFollowUp ? 'ativo' : saindoDeFollowUp ? 'inativo' : undefined;

    // Optimistic update: atualiza a UI imediatamente para dar sensação de resposta instantânea
    // no drag and drop, antes mesmo de confirmar a escrita no banco.
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              estagio_lead: novoEstagio,
              ...(followManual ? { follow_manual: followManual } : {}),
            }
          : l
      )
    );

    const supabase = createClient();
    const { error } = await supabase
      .from('BASE_DE_LEADS')
      .update({
        estagio_lead: novoEstagio,
        ...(followManual ? { follow_manual: followManual } : {}),
      })
      .eq('id', leadId);

    if (error) {
      // Rollback em caso de erro de escrita, e aviso simples ao usuário.
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, estagio_lead: estagioAnterior } : l))
      );
      setErrorMessage('Não foi possível mover o lead. Tente novamente.');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    await supabase.from('lead_historico_estagio').insert({
      id_lead: leadId,
      estagio_anterior: estagioAnterior,
      estagio_novo: novoEstagio,
      usuario: nomeUsuario,
    });
    await filters.refreshActivityDates();
    if (novoEstagio === 'fechado') setCelebracao(leadAtual.nome_lead);

  }

  async function confirmarVenda(nome: string, valor: number, veiculoId: number): Promise<boolean> {
    if (!vendaPendente) return false;
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fechar_venda_com_veiculo', {
      p_id_lead: vendaPendente.id,
      p_nome: nome,
      p_valor: valor,
      p_estoque_id: String(veiculoId),
    }).single();
    if (error || !data) {
      setErrorMessage('Não foi possível fechar a venda. Verifique os dados e tente novamente.');
      return false;
    }
    setLeads((prev) => prev.map((item) => item.id === vendaPendente.id ? data as BaseDeLeads : item));
    await supabase.from('lead_historico_estagio').insert({ id_lead: vendaPendente.id, estagio_anterior: vendaPendente.estagio_lead, estagio_novo: 'fechado', usuario: nomeUsuario });
    await filters.refreshActivityDates();
    setVendaPendente(null);
    setCelebracao(nome);
    return true;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        <p className="text-sm text-gray-500">
          {leadsFiltrados.length} lead(s) exibido(s). Arraste os cards entre as etapas do funil
        </p>
        <p className="text-xs text-gray-400">{duplicateCount} lead(s) duplicado(s) removido(s) da exibição.</p>
        {loadError && <p className="mt-1 text-xs text-red-600">Erro ao carregar pipeline: {loadError}</p>}
        {erroEtapas && <p className="mt-1 text-xs text-amber-600">{erroEtapas}</p>}
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{errorMessage}</div>
      )}

      <LeadFiltersBar filters={filters} showDataReference />

      {loading ? (
        <AutomotiveLoading label="Carregando pipeline" />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-4">
            {colunas.map((coluna) => (
              <Column
                key={coluna.id}
                id={coluna.id}
                label={coluna.label}
                color={coluna.color}
                leads={leadsPorColuna.get(coluna.id) ?? []}
                onOpenLead={setLeadSelecionado}
              />
            ))}
          </div>
        </DndContext>
      )}

      {leadSelecionado && (
        <LeadDrawer
          lead={leadSelecionado}
          estagioLabel={
            colunas.find((c) => c.id === normalizeEstagio(leadSelecionado.estagio_lead, etapas))?.label ??
            'Oportunidade'
          }
          estagioColor={
            colunas.find((c) => c.id === normalizeEstagio(leadSelecionado.estagio_lead, etapas))?.color ??
            '#22c55e'
          }
          estagioLabelOf={(estagio) => colunas.find((c) => c.id === normalizeEstagio(estagio, etapas))?.label ?? estagio}
          onClose={() => setLeadSelecionado(null)}
          onUpdated={(atualizado) => {
            setLeadSelecionado(atualizado);
            setLeads((prev) => prev.map((l) => (l.id === atualizado.id ? atualizado : l)));
            void filters.refreshActivityDates();
          }}
          onDeleted={(leadId) => {
            setLeads((leadsAtuais) => leadsAtuais.filter((l) => l.id !== leadId));
            setLeadSelecionado(null);
          }}
        />
      )}
      {vendaPendente && <VendaFechadaModal lead={vendaPendente} onCancel={() => setVendaPendente(null)} onConfirm={confirmarVenda} />}
      {celebracao && <SaleCelebration leadName={celebracao} onClose={fecharCelebracao} />}
    </div>
  );
}
