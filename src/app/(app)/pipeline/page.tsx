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
import type { BaseDeLeads } from '@/types/database';
import { deduplicateLeads, fetchAllLeads } from '@/lib/leads';
import { Avatar } from '@/components/Avatar';
import { LeadDrawer } from '@/components/LeadDrawer';
import { LeadFiltersBar } from '@/components/LeadFiltersBar';
import { ESTAGIO_CONFIG } from '@/components/StatusBadge';
import { useLeadFilters } from '@/hooks/useLeadFilters';
import { formatContagem } from '@/lib/negociacao/tempo';
import { statusAtendimentoDoLead, type StatusAtendimento } from '@/lib/negociacao/etiquetasAtendimento';
import { AutomotiveLoading } from '@/components/AutomotiveLoading';
import { SaleCelebration } from '@/components/SaleCelebration';

const TICK_MS = 1_000;

function VendaFechadaModal({ lead, onCancel, onConfirm }: { lead: BaseDeLeads; onCancel: () => void; onConfirm: (nome: string, valor: number) => void }) {
  const [nome, setNome] = useState(lead.nome_lead ?? '');
  const [valor, setValor] = useState(lead.valor ? String(lead.valor) : '');
  const numero = Number(valor.replace(',', '.'));
  const valido = Boolean(nome.trim()) && Number.isFinite(numero) && numero > 0;
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-bold">Complete os dados da venda</h2><p className="mt-1 text-sm text-gray-500">Nome e valor são obrigatórios para fechar o negócio.</p><label className="mt-5 block text-sm font-medium">Nome do lead</label><input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /><label className="mt-4 block text-sm font-medium">Valor da venda</label><input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2" /><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button type="button" disabled={!valido} onClick={() => onConfirm(nome.trim(), numero)} className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-40">Confirmar venda</button></div></div></div>;
}

// As colunas do Pipeline são geradas a partir de ESTAGIO_CONFIG (StatusBadge.tsx), que contém
// exatamente os valores aceitos pela constraint CHECK de estagio_lead no banco. Não adicione um
// estágio aqui sem confirmar antes que o valor existe na constraint real — caso contrário o
// drag-and-drop vai falhar com erro 23514 ao tentar salvar.
const COLUNAS = (Object.keys(ESTAGIO_CONFIG) as Array<keyof typeof ESTAGIO_CONFIG>).map((id) => ({
  id,
  label: ESTAGIO_CONFIG[id].label,
  color: ESTAGIO_CONFIG[id].color,
}));

type ColunaId = (typeof COLUNAS)[number]['id'];

function normalizeEstagio(estagio: string): ColunaId {
  const key = estagio.toLowerCase().trim();
  const found = COLUNAS.find((c) => c.id === key);
  return found ? found.id : 'oportunidade';
}

// Timer de negociação exibido no próprio card do Pipeline: quando o lead já tem a etiqueta
// "Atendimento finalizado", vira um selo fixo "Finalizado" (para de contar, não some); com
// "Atendimento iniciado" continua contando normalmente, só que em verde (ver
// src/lib/negociacao/etiquetasAtendimento.ts).
function TimerNegociacaoCard({ expiraEm, agora, statusAtendimento }: { expiraEm: string; agora: number; statusAtendimento: StatusAtendimento }) {
  if (statusAtendimento === 'finalizado') {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
        Finalizado
      </span>
    );
  }

  const restante = new Date(expiraEm).getTime() - agora;
  const vencido = restante <= 0;
  const iniciado = statusAtendimento === 'iniciado';
  const cor = iniciado ? 'bg-green-50 text-green-700' : vencido ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700';

  return (
    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cor}`}>
      {vencido && !iniciado ? 'Vencido' : formatContagem(restante)}
    </span>
  );
}

interface CardProps {
  lead: BaseDeLeads;
  onOpen: (lead: BaseDeLeads) => void;
  agora: number;
  statusAtendimento: StatusAtendimento;
}

function LeadCard({ lead, onOpen, agora, statusAtendimento }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const mostrarTimer = normalizeEstagio(lead.estagio_lead) === 'em_negociacao' && !!lead.negociacao_expira_em;

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
      {mostrarTimer && (
        <TimerNegociacaoCard
          expiraEm={lead.negociacao_expira_em as string}
          agora={agora}
          statusAtendimento={statusAtendimento}
        />
      )}
    </div>
  );
}

interface ColumnProps {
  id: ColunaId;
  label: string;
  color: string;
  leads: BaseDeLeads[];
  onOpenLead: (lead: BaseDeLeads) => void;
  agora: number;
  statusAtendimentoPorLead: Map<number, StatusAtendimento>;
}

const LEADS_POR_PAGINA = 8;

function Column({ id, label, color, leads, onOpenLead, agora, statusAtendimentoPorLead }: ColumnProps) {
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
              agora={agora}
              statusAtendimento={statusAtendimentoPorLead.get(lead.id) ?? null}
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
  const [agora, setAgora] = useState(() => Date.now());
  const filters = useLeadFilters(leads);
  const { leadsFiltrados } = filters;
  const [vendaPendente, setVendaPendente] = useState<BaseDeLeads | null>(null);
  const [celebracao, setCelebracao] = useState<string | null>(null);
  const fecharCelebracao = useCallback(() => setCelebracao(null), []);

  // Tick de 1s só para recalcular a contagem regressiva dos timers nos cards, sem re-buscar
  // os leads do banco.
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), TICK_MS);
    return () => clearInterval(intervalo);
  }, []);

  const etiquetaNomePorId = useMemo(
    () => new Map(filters.etiquetasDisponiveis.map((etiqueta) => [etiqueta.id, etiqueta.nome])),
    [filters.etiquetasDisponiveis]
  );

  const statusAtendimentoPorLead = useMemo(() => {
    const map = new Map<number, StatusAtendimento>();
    leads.forEach((lead) => {
      map.set(lead.id, statusAtendimentoDoLead(filters.etiquetasPorLead.get(lead.id), etiquetaNomePorId));
    });
    return map;
  }, [leads, filters.etiquetasPorLead, etiquetaNomePorId]);

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
              'id, id_empresa, nome_lead, telefone, email, origem, vendedor, veiculo_interesse, resumo_qualificacao, estagio_lead, resumo_comercial, created_at, updated_at, valor, observacao_vendedor, bot_ativo, bot_ativo_alterado_em, "Etapa", "QuemEnviouMsg", "UltimaMensagem", StatusDeFollow:"Status de Follow", "Transferencia", PesquisaDeSatisfacao:"Pesquisa de satisfação", cpf, data_nascimento, score_serasa, follow_manual, negociacao_expira_em, negociacao_notificado_em, negociacao_extensoes'
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
    const refresh = () => void fetchLeads();
    window.addEventListener('lead-assignments-changed', refresh);
    return () => {
      isMounted = false;
      window.removeEventListener('lead-assignments-changed', refresh);
    };
  }, []);

  const leadsPorColuna = useMemo(() => {
    const map = new Map<ColunaId, BaseDeLeads[]>(COLUNAS.map((c) => [c.id, []]));
    leadsFiltrados.forEach((lead) => {
      const coluna = normalizeEstagio(lead.estagio_lead);
      map.get(coluna)?.push(lead);
    });
    return map;
  }, [leadsFiltrados]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = Number(active.id);
    const overId = over.id;
    const colunaDireta = COLUNAS.find((c) => c.id === overId)?.id;
    const leadDestino = leads.find((l) => l.id === Number(overId));
    const novoEstagio = colunaDireta ?? (leadDestino ? normalizeEstagio(leadDestino.estagio_lead) : null);
    if (!novoEstagio) return;

    const leadAtual = leads.find((l) => l.id === leadId);
    if (!leadAtual) return;
    if (novoEstagio === 'fechado' && (!leadAtual.nome_lead?.trim() || !leadAtual.valor || leadAtual.valor <= 0)) {
      setVendaPendente(leadAtual);
      return;
    }

    const estagioAnterior = leadAtual.estagio_lead;
    if (normalizeEstagio(estagioAnterior) === novoEstagio) return;

    const entrandoEmFollowUp = novoEstagio === 'follow_up';
    const saindoDeFollowUp = normalizeEstagio(estagioAnterior) === 'follow_up' && !entrandoEmFollowUp;
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

    // Ao entrar em "em_negociacao" inicia o cronômetro de 30min; ao sair, limpa o prazo para
    // não deixar um popup de expiração "fantasma" caso o lead volte depois para essa coluna.
    const entrandoEmNegociacao = novoEstagio === 'em_negociacao';
    const saindoDeNegociacao = normalizeEstagio(estagioAnterior) === 'em_negociacao' && !entrandoEmNegociacao;

    const supabase = createClient();

    // Ao entrar/sair de "em_negociacao" também resetamos os campos de status de notificação
    // (negociacao_notificacao_status/erro/reivindicada_em), senão um ciclo antigo poderia
    // deixar o lead marcado como já notificado/reivindicado quando o cronômetro reiniciar.
    const camposNegociacaoCompletos = entrandoEmNegociacao
      ? {
          negociacao_expira_em: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          negociacao_notificado_em: null,
          negociacao_extensoes: 0,
          negociacao_notificacao_status: null,
          negociacao_notificacao_erro: null,
          negociacao_notificacao_reivindicada_em: null,
        }
      : saindoDeNegociacao
        ? {
            negociacao_expira_em: null,
            negociacao_notificado_em: null,
            negociacao_extensoes: 0,
            negociacao_notificacao_status: null,
            negociacao_notificacao_erro: null,
            negociacao_notificacao_reivindicada_em: null,
          }
        : {};

    let { error } = await supabase
      .from('BASE_DE_LEADS')
      .update({
        estagio_lead: novoEstagio,
        ...camposNegociacaoCompletos,
        ...(followManual ? { follow_manual: followManual } : {}),
      })
      .eq('id', leadId);

    // Fallback: as colunas de status de notificação (migration 0009) ainda não existem nesse
    // ambiente. Refaz o update só com as colunas básicas do cronômetro (migration 0008).
    if (error && (error.code === '42703' || /column|schema cache/i.test(error.message))) {
      const camposBasicos = entrandoEmNegociacao
        ? {
            negociacao_expira_em: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            negociacao_notificado_em: null,
            negociacao_extensoes: 0,
          }
        : saindoDeNegociacao
          ? { negociacao_expira_em: null, negociacao_notificado_em: null, negociacao_extensoes: 0 }
          : {};

      ({ error } = await supabase
        .from('BASE_DE_LEADS')
        .update({
          estagio_lead: novoEstagio,
          ...camposBasicos,
          ...(followManual ? { follow_manual: followManual } : {}),
        })
        .eq('id', leadId));
    }

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
    if (novoEstagio === 'fechado') setCelebracao(leadAtual.nome_lead);

  }

  async function confirmarVenda(nome: string, valor: number) {
    if (!vendaPendente) return;
    const supabase = createClient();
    const { data, error } = await supabase.from('BASE_DE_LEADS').update({ nome_lead: nome, valor, estagio_lead: 'fechado' }).eq('id', vendaPendente.id).select('*').single();
    if (error || !data) {
      setErrorMessage('Não foi possível fechar a venda. Verifique os dados e tente novamente.');
      return;
    }
    setLeads((prev) => prev.map((item) => item.id === vendaPendente.id ? data as BaseDeLeads : item));
    await supabase.from('lead_historico_estagio').insert({ id_lead: vendaPendente.id, estagio_anterior: vendaPendente.estagio_lead, estagio_novo: 'fechado', usuario: nomeUsuario });
    setVendaPendente(null);
    setCelebracao(nome);
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
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{errorMessage}</div>
      )}

      <LeadFiltersBar filters={filters} />

      {loading ? (
        <AutomotiveLoading label="Carregando pipeline" />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-4">
            {COLUNAS.map((coluna) => (
              <Column
                key={coluna.id}
                id={coluna.id}
                label={coluna.label}
                color={coluna.color}
                leads={leadsPorColuna.get(coluna.id) ?? []}
                onOpenLead={setLeadSelecionado}
                agora={agora}
                statusAtendimentoPorLead={statusAtendimentoPorLead}
              />
            ))}
          </div>
        </DndContext>
      )}

      {leadSelecionado && (
        <LeadDrawer
          lead={leadSelecionado}
          estagioLabel={
            COLUNAS.find((c) => c.id === normalizeEstagio(leadSelecionado.estagio_lead))?.label ??
            'Oportunidade'
          }
          estagioColor={
            COLUNAS.find((c) => c.id === normalizeEstagio(leadSelecionado.estagio_lead))?.color ??
            '#22c55e'
          }
          estagioLabelOf={(estagio) => COLUNAS.find((c) => c.id === normalizeEstagio(estagio))?.label ?? estagio}
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
      {vendaPendente && <VendaFechadaModal lead={vendaPendente} onCancel={() => setVendaPendente(null)} onConfirm={confirmarVenda} />}
      {celebracao && <SaleCelebration leadName={celebracao} onClose={fecharCelebracao} />}
    </div>
  );
}
