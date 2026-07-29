'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BaseDeLeads, Cargo } from '@/types/database';
import { formatContagem } from '@/lib/negociacao/tempo';
import { statusAtendimentoDoLead, type StatusAtendimento } from '@/lib/negociacao/etiquetasAtendimento';
import { LeadDrawer } from '@/components/LeadDrawer';
import { usePipelineEtapas } from '@/hooks/usePipelineEtapas';
import { etapaDe } from '@/lib/pipeline-etapas';

// Watcher client-side do cronômetro de 30min de "Em Negociação":
// - Faz polling (20s) dos leads ativos nesse estágio e mantém um painel flutuante com a
//   contagem regressiva de cada um, atualizada a cada 1s sem re-buscar do banco. O painel fica
//   sempre visível (minimizável em um badge), mesmo sem nenhuma negociação ativa no momento.
// - Ao detectar um lead vencido, dispara (fire-and-forget) POST em /api/negociacao/notificar,
//   que reivindica a notificação de forma atômica no servidor e aciona o webhook do n8n — o
//   cron de /api/negociacao/processar-vencidas cobre o caso de ninguém estar com o CRM aberto.
// - Leads com a etiqueta "Atendimento finalizado" saem da lista (o cronômetro deles não faz
//   mais sentido); leads com "Atendimento iniciado" continuam aparecendo, só que em verde.
// - Todo update de campos negociacao_* tenta primeiro o conjunto completo de colunas e cai para
//   um fallback só com as colunas antigas se o erro indicar coluna inexistente/schema cache
//   desatualizado (migration mais nova ainda não rodou nesse ambiente).

interface LeadNegociacao {
  id: number;
  nome_lead: string;
  vendedor: string | null;
  negociacao_expira_em: string;
  negociacao_extensoes: number;
  statusAtendimento: StatusAtendimento;
}

const INTERVALO_POLL_MS = 20_000;
const INTERVALO_TICK_MS = 1_000;
const LEAD_COMPLETO_SELECT =
  'id, id_empresa, nome_lead, telefone, email, origem, vendedor, veiculo_interesse, resumo_qualificacao, estagio_lead, resumo_comercial, created_at, updated_at, valor, observacao_vendedor, bot_ativo, bot_ativo_alterado_em, "Etapa", "QuemEnviouMsg", "UltimaMensagem", StatusDeFollow:"Status de Follow", "Transferencia", PesquisaDeSatisfacao:"Pesquisa de satisfação", IdContatoClick:"ID CONTATO CLICK", lid, DataEHora:"Data e Hora", cpf, data_nascimento, score_serasa, negociacao_expira_em, negociacao_notificado_em, negociacao_extensoes, negociacao_notificacao_status, negociacao_notificacao_tentativas, negociacao_notificacao_erro, negociacao_notificacao_reivindicada_em';

interface NegociacaoTimerWatcherProps {
  userCargo: Cargo;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

function isSchemaCacheError(error: SupabaseErrorLike | null): boolean {
  if (!error) return false;
  if (error.code === '42703') return true;
  const msg = error.message?.toLowerCase() ?? '';
  return msg.includes('column') || msg.includes('schema cache');
}

function SininhoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a1 1 0 0 0-1 1v1.06A7 7 0 0 0 5 11v3.38l-1.7 2.55A1 1 0 0 0 4.14 18h15.72a1 1 0 0 0 .84-1.55L19 14.38V11a7 7 0 0 0-6-6.94V3a1 1 0 0 0-1-1Zm0 20a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z" />
    </svg>
  );
}

const RESET_COMPLETO = {
  negociacao_expira_em: null,
  negociacao_notificado_em: null,
  negociacao_extensoes: 0,
  negociacao_notificacao_status: null,
  negociacao_notificacao_erro: null,
  negociacao_notificacao_reivindicada_em: null,
};

const RESET_BASICO = {
  negociacao_expira_em: null,
  negociacao_notificado_em: null,
  negociacao_extensoes: 0,
};

async function resetarNegociacao(leadId: number) {
  const supabase = createClient();
  const { error } = await supabase.from('BASE_DE_LEADS').update(RESET_COMPLETO).eq('id', leadId);

  if (error && isSchemaCacheError(error)) {
    await supabase.from('BASE_DE_LEADS').update(RESET_BASICO).eq('id', leadId);
  }
}

export function NegociacaoTimerWatcher({ userCargo }: NegociacaoTimerWatcherProps) {
  const [negociacoes, setNegociacoes] = useState<LeadNegociacao[]>([]);
  const [agora, setAgora] = useState(() => Date.now());
  const [minimizado, setMinimizado] = useState(false);
  const [dispensados, setDispensados] = useState<Set<string>>(new Set());
  const [leadPopup, setLeadPopup] = useState<LeadNegociacao | null>(null);
  const [leadSelecionado, setLeadSelecionado] = useState<BaseDeLeads | null>(null);
  const [estendendo, setEstendendo] = useState(false);
  const [leadParaExcluir, setLeadParaExcluir] = useState<LeadNegociacao | null>(null);
  const { etapas } = usePipelineEtapas();

  const podeEstender = userCargo === 'admin_master' || userCargo === 'admin' || userCargo === 'gerente';

  useEffect(() => {
    let isMounted = true;

    async function verificar() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('BASE_DE_LEADS')
        .select('id, nome_lead, vendedor, negociacao_expira_em, negociacao_extensoes')
        .eq('estagio_lead', 'em_negociacao')
        .not('negociacao_expira_em', 'is', null)
        .order('negociacao_expira_em', { ascending: true });

      if (!isMounted) return;

      if (error) {
        // Colunas do cronômetro ainda não existem nesse ambiente (migration não rodou) ou o
        // schema cache do Supabase está desatualizado: não quebra o app, só não mostra o painel.
        if (!isSchemaCacheError(error)) {
          console.error('Erro ao verificar negociações:', error.message);
        }
        setNegociacoes([]);
        return;
      }

      const listaBruta = (data as { id: number; nome_lead: string; vendedor: string | null; negociacao_expira_em: string; negociacao_extensoes: number }[]) ?? [];

      if (listaBruta.length === 0) {
        setNegociacoes([]);
        return;
      }

      // Busca as etiquetas dos leads em negociação para saber se algum já tem "Atendimento
      // iniciado" (cronômetro fica verde) ou "Atendimento finalizado" (cronômetro vira um selo
      // fixo "Finalizado", sem contagem — mas continua na lista, não some).
      const ids = listaBruta.map((l) => l.id);
      const [{ data: etiquetasData }, { data: vinculosData }] = await Promise.all([
        supabase.from('etiquetas').select('id, nome'),
        supabase.from('lead_etiquetas').select('id_lead, id_etiqueta').in('id_lead', ids),
      ]);

      if (!isMounted) return;

      const nomePorId = new Map<number, string>(
        ((etiquetasData as { id: number; nome: string }[]) ?? []).map((e) => [e.id, e.nome])
      );
      const etiquetasPorLead = new Map<number, Set<number>>();
      ((vinculosData as { id_lead: number; id_etiqueta: number }[]) ?? []).forEach((v) => {
        const set = etiquetasPorLead.get(v.id_lead) ?? new Set<number>();
        set.add(v.id_etiqueta);
        etiquetasPorLead.set(v.id_lead, set);
      });

      const lista = listaBruta.map((lead) => ({
        ...lead,
        statusAtendimento: statusAtendimentoDoLead(etiquetasPorLead.get(lead.id), nomePorId),
      }));

      setNegociacoes(lista);

      // Leads com "Atendimento finalizado" não disparam mais notificação: o atendimento já
      // acabou, não faz sentido continuar cobrando o vendedor por esse prazo.
      const agoraIso = new Date().toISOString();
      const vencidos = lista.filter(
        (l) => l.statusAtendimento !== 'finalizado' && l.negociacao_expira_em <= agoraIso
      );

      // Fire-and-forget: reivindica a notificação (idempotente no servidor) para cada lead
      // vencido encontrado neste poll. Erros são ignorados aqui — o cron cuida do retry.
      vencidos.forEach((lead) => {
        fetch('/api/negociacao/notificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.id }),
        }).catch(() => {});
      });
    }

    verificar();
    const intervalo = setInterval(verificar, INTERVALO_POLL_MS);

    // Reflete na hora quando uma etiqueta é alterada em algum lead (ex: LeadDrawer), sem
    // esperar o próximo ciclo de 20s.
    function handleEtiquetasAtualizadas() {
      verificar();
    }
    window.addEventListener('lead-etiquetas-updated', handleEtiquetasAtualizadas);

    return () => {
      isMounted = false;
      clearInterval(intervalo);
      window.removeEventListener('lead-etiquetas-updated', handleEtiquetasAtualizadas);
    };
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), INTERVALO_TICK_MS);
    return () => clearInterval(intervalo);
  }, []);

  // Abre automaticamente o popup do primeiro lead vencido ainda não dispensado neste ciclo
  // de vencimento (chave composta id:expira_em, para reabrir se o prazo for estendido depois).
  useEffect(() => {
    const vencido = negociacoes.find(
      (l) => l.statusAtendimento !== 'finalizado' && new Date(l.negociacao_expira_em).getTime() <= agora
    );
    if (!vencido) {
      setLeadPopup(null);
      return;
    }
    const chave = `${vencido.id}:${vencido.negociacao_expira_em}`;
    if (dispensados.has(chave)) {
      setLeadPopup(null);
      return;
    }
    setLeadPopup(vencido);
  }, [negociacoes, agora, dispensados]);

  const negociacoesOrdenadas = useMemo(
    () => [...negociacoes].sort((a, b) => a.negociacao_expira_em.localeCompare(b.negociacao_expira_em)),
    [negociacoes]
  );

  function fecharPopup() {
    if (leadPopup) {
      const chave = `${leadPopup.id}:${leadPopup.negociacao_expira_em}`;
      setDispensados((prev) => new Set(prev).add(chave));
    }
    setLeadPopup(null);
  }

  async function abrirLeadCompleto(lead: LeadNegociacao) {
    const chave = `${lead.id}:${lead.negociacao_expira_em}`;
    setDispensados((prev) => new Set(prev).add(chave));
    setLeadPopup(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from('BASE_DE_LEADS')
      .select(LEAD_COMPLETO_SELECT)
      .eq('id', lead.id)
      .single();

    if (error) {
      console.error('Erro ao abrir lead:', error.message);
      return;
    }

    setLeadSelecionado(data as unknown as BaseDeLeads);
  }

  function estagioLabelOf(estagio: string | null | undefined) {
    return etapaDe(estagio, etapas)?.nome ?? 'Desconhecido';
  }

  function estagioColorOf(estagio: string | null | undefined) {
    return etapaDe(estagio, etapas)?.cor ?? '#6b7280';
  }

  async function estenderPrazo(lead: LeadNegociacao) {
    setEstendendo(true);
    const supabase = createClient();
    const novoPrazo = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const atualizacaoCompleta = {
      negociacao_expira_em: novoPrazo,
      negociacao_notificado_em: null,
      negociacao_extensoes: lead.negociacao_extensoes + 1,
      negociacao_notificacao_status: null,
      negociacao_notificacao_erro: null,
      negociacao_notificacao_reivindicada_em: null,
    };

    const { error } = await supabase.from('BASE_DE_LEADS').update(atualizacaoCompleta).eq('id', lead.id);

    if (error && isSchemaCacheError(error)) {
      await supabase
        .from('BASE_DE_LEADS')
        .update({
          negociacao_expira_em: novoPrazo,
          negociacao_notificado_em: null,
          negociacao_extensoes: lead.negociacao_extensoes + 1,
        })
        .eq('id', lead.id);
    }

    setEstendendo(false);
    setLeadPopup(null);
    setNegociacoes((prev) =>
      prev.map((l) =>
        l.id === lead.id
          ? { ...l, negociacao_expira_em: novoPrazo, negociacao_extensoes: lead.negociacao_extensoes + 1 }
          : l
      )
    );
  }

  async function cancelarCronometro(lead: LeadNegociacao) {
    setNegociacoes((prev) => prev.filter((l) => l.id !== lead.id));
    if (leadPopup?.id === lead.id) setLeadPopup(null);
    await resetarNegociacao(lead.id);
  }

  async function confirmarExclusao() {
    if (!leadParaExcluir) return;
    const lead = leadParaExcluir;
    setLeadParaExcluir(null);
    setNegociacoes((prev) => prev.filter((l) => l.id !== lead.id));
    if (leadPopup?.id === lead.id) setLeadPopup(null);
    await resetarNegociacao(lead.id);
  }

  return (
    <>
      {leadPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold text-foreground">Tempo de negociação esgotado</h2>
            <p className="mt-2 text-sm text-gray-600">
              O lead{' '}
              <button
                type="button"
                onClick={() => abrirLeadCompleto(leadPopup)}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {leadPopup.nome_lead}
              </button>
              {leadPopup.vendedor && (
                <>
                  {' '}
                  (vendedor <span className="font-medium">{leadPopup.vendedor}</span>)
                </>
              )}{' '}
              está em negociação há mais de 30 minutos.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={fecharPopup}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Fechar
              </button>
              {podeEstender && (
                <button
                  onClick={() => estenderPrazo(leadPopup)}
                  disabled={estendendo}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {estendendo ? 'Estendendo...' : 'Estender +30min'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {leadParaExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold text-foreground">Excluir notificação</h2>
            <p className="mt-2 text-sm text-gray-600">
              Isso vai cancelar o cronômetro de negociação do lead{' '}
              <span className="font-medium">{leadParaExcluir.nome_lead}</span> e remover esta
              notificação. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setLeadParaExcluir(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* O painel/sininho fica sempre visível, mesmo com zero negociações ativas no momento.
          Sem w-72 quando minimizado: senão o círculo fica alinhado à esquerda de um container
          invisível de 288px, longe do canto de verdade. */}
      <div className={`fixed bottom-2 right-2 z-40 ${minimizado ? '' : 'w-72'}`}>
        {minimizado ? (
          <button
            onClick={() => setMinimizado(false)}
            className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg hover:opacity-90"
            title="Negociações ativas"
          >
            <SininhoIcon className="h-6 w-6 text-red-500" />
            {negociacoesOrdenadas.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {negociacoesOrdenadas.length}
              </span>
            )}
          </button>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50">
                  <SininhoIcon className="h-5 w-5 text-red-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Negociações</p>
                  <p className="text-xs text-gray-500">{negociacoesOrdenadas.length} ativo(s)</p>
                </div>
              </div>
              <button
                onClick={() => setMinimizado(true)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Minimizar"
              >
                &#8211;
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {negociacoesOrdenadas.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-400">Nenhuma negociação ativa.</p>
              ) : (
                negociacoesOrdenadas.map((lead) => {
                  const finalizado = lead.statusAtendimento === 'finalizado';
                  const restante = new Date(lead.negociacao_expira_em).getTime() - agora;
                  const vencido = !finalizado && restante <= 0;
                  const iniciado = lead.statusAtendimento === 'iniciado';
                  const corTempo = finalizado
                    ? 'text-gray-400'
                    : iniciado
                      ? 'text-green-600'
                      : vencido
                        ? 'text-red-600'
                        : 'text-gray-700';
                  return (
                    <div key={lead.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{lead.nome_lead}</p>
                        <span className={`text-sm font-semibold ${corTempo}`}>
                          {finalizado ? 'Finalizado' : vencido && !iniciado ? 'Vencido' : formatContagem(restante)}
                        </span>
                      </div>
                      {lead.vendedor && <p className="truncate text-xs text-gray-500">{lead.vendedor}</p>}
                      <div className="mt-2 flex justify-end gap-3">
                        <button
                          onClick={() => cancelarCronometro(lead)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => setLeadParaExcluir(lead)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {leadSelecionado && (
        <LeadDrawer
          lead={leadSelecionado}
          estagioLabel={estagioLabelOf(leadSelecionado.estagio_lead)}
          estagioColor={estagioColorOf(leadSelecionado.estagio_lead)}
          estagioLabelOf={estagioLabelOf}
          onClose={() => setLeadSelecionado(null)}
          onUpdated={(atualizado) => {
            setLeadSelecionado(atualizado);
            setNegociacoes((prev) =>
              prev.map((lead) =>
                lead.id === atualizado.id
                  ? {
                      ...lead,
                      nome_lead: atualizado.nome_lead,
                      vendedor: atualizado.vendedor,
                      negociacao_expira_em: atualizado.negociacao_expira_em ?? lead.negociacao_expira_em,
                      negociacao_extensoes: atualizado.negociacao_extensoes,
                    }
                  : lead
              )
            );
          }}
          onDeleted={(leadId) => {
            setNegociacoes((leadsAtuais) => leadsAtuais.filter((l) => l.id !== leadId));
            setLeadSelecionado(null);
          }}
        />
      )}
    </>
  );
}
