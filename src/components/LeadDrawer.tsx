'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BaseDeLeads, Etiqueta, LeadHistoricoEstagio, Vendedor } from '@/types/database';
import { Avatar } from '@/components/Avatar';
import { isDentroExpediente } from '@/lib/expediente';
import {
  confirmarExclusao,
  confirmarTransicaoBot,
  criarTravaDeMutacao,
  formatarUltimaAlteracaoBot,
  normalizarBotAtivo,
} from '@/lib/lead-management';

function calcularIdade(dataNascimento: string | null): number | null {
  if (!dataNascimento) return null;
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
  if (aindaNaoFezAniversario) idade--;
  return idade;
}

function classificacaoSerasa(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'Sem dados', color: '#9ca3af' };
  if (score < 300) return { label: 'Ruim', color: '#ef4444' };
  if (score < 500) return { label: 'Regular', color: '#f59e0b' };
  if (score < 700) return { label: 'Bom', color: '#3b82f6' };
  return { label: 'Excelente', color: '#22c55e' };
}

function telefoneParaWhatsapp(telefone: string | null | undefined): string | null {
  const numero = telefone?.replace(/\D/g, '') ?? '';
  return numero ? `https://wa.me/${numero}` : null;
}

interface LeadDrawerProps {
  lead: BaseDeLeads;
  estagioLabel: string;
  estagioColor: string;
  estagioLabelOf: (estagio: string) => string;
  onClose: () => void;
  onUpdated: (lead: BaseDeLeads) => void;
  onDeleted: (leadId: number) => void;
}

export function LeadDrawer({
  lead,
  estagioLabel,
  estagioColor,
  estagioLabelOf,
  onClose,
  onUpdated,
  onDeleted,
}: LeadDrawerProps) {
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasDoLead, setEtiquetasDoLead] = useState<Set<number>>(new Set());
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [historico, setHistorico] = useState<LeadHistoricoEstagio[]>([]);

  const [logs, setLogs] = useState<Array<{ id: number; acao: string; responsavel_nome: string | null; detalhes: { campos_alterados?: string[] } | null; created_at: string }>>([]);
  const [observacao, setObservacao] = useState(lead.observacao_vendedor ?? '');
  const [salvandoObservacao, setSalvandoObservacao] = useState(false);
  const [mensagemObservacao, setMensagemObservacao] = useState<string | null>(null);
  const [alterandoBot, setAlterandoBot] = useState(false);
  const [mensagemBot, setMensagemBot] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);
  const mutacaoEmAndamentoRef = useRef(criarTravaDeMutacao());

  const [campos, setCampos] = useState({
    cpf: lead.cpf ?? '',
    data_nascimento: lead.data_nascimento ?? '',
    veiculo_interesse: lead.veiculo_interesse ?? '',
    valor: lead.valor !== null ? String(lead.valor) : '',
    vendedor: lead.vendedor ?? '',
  });
  const [salvandoCampos, setSalvandoCampos] = useState(false);
  const [mensagemCampos, setMensagemCampos] = useState<string | null>(null);

  useEffect(() => {
    setObservacao(lead.observacao_vendedor ?? '');
    setCampos({
      cpf: lead.cpf ?? '',
      data_nascimento: lead.data_nascimento ?? '',
      veiculo_interesse: lead.veiculo_interesse ?? '',
      valor: lead.valor !== null ? String(lead.valor) : '',
      vendedor: lead.vendedor ?? '',
    });
  }, [lead.id, lead.observacao_vendedor, lead.cpf, lead.data_nascimento, lead.veiculo_interesse, lead.valor, lead.vendedor]);

  useEffect(() => {
    let isMounted = true;
    async function fetchDados() {
      const supabase = createClient();
      const [{ data: todasEtiquetas }, { data: doLead }, { data: vendedoresData }, { data: historicoData }, { data: logsData }] =
        await Promise.all([
          supabase.from('etiquetas').select('id, nome, cor, created_at').order('nome'),
          supabase.from('lead_etiquetas').select('id_etiqueta').eq('id_lead', lead.id),
          supabase
            .from('VENDEDORES')
            .select('id, created_at, vendedor, telefone, atender, quantos_lead, id_click, id_empresa, ativo')
            .eq('ativo', true)
            .order('vendedor'),
          supabase
            .from('lead_historico_estagio')
            .select('id, id_lead, estagio_anterior, estagio_novo, usuario, created_at')
            .eq('id_lead', lead.id)
            .order('created_at', { ascending: false }),
          supabase.from('lead_logs').select('id, acao, responsavel_nome, detalhes, created_at').eq('id_lead', lead.id).order('created_at', { ascending: false }),
        ]);
      if (!isMounted) return;
      setEtiquetas((todasEtiquetas as Etiqueta[]) ?? []);
      setEtiquetasDoLead(new Set(((doLead as { id_etiqueta: number }[]) ?? []).map((e) => e.id_etiqueta)));
      setVendedores((vendedoresData as Vendedor[]) ?? []);
      setHistorico((historicoData as LeadHistoricoEstagio[]) ?? []);
      setLogs((logsData as typeof logs) ?? []);
    }
    fetchDados();
    return () => {
      isMounted = false;
    };
  }, [lead.id]);

  async function toggleEtiqueta(idEtiqueta: number) {
    const supabase = createClient();
    const jaTem = etiquetasDoLead.has(idEtiqueta);

    setEtiquetasDoLead((prev) => {
      const next = new Set(prev);
      if (jaTem) next.delete(idEtiqueta);
      else next.add(idEtiqueta);
      return next;
    });

    if (jaTem) {
      await supabase
        .from('lead_etiquetas')
        .delete()
        .eq('id_lead', lead.id)
        .eq('id_etiqueta', idEtiqueta);
    } else {
      await supabase.from('lead_etiquetas').insert({ id_lead: lead.id, id_etiqueta: idEtiqueta });
    }

    window.dispatchEvent(new CustomEvent('lead-etiquetas-updated', { detail: { leadId: lead.id } }));
  }

  async function salvarObservacao() {
    if (!mutacaoEmAndamentoRef.current.tentarAdquirir()) return;
    setSalvandoObservacao(true);
    setMensagemObservacao(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('BASE_DE_LEADS')
      .update({ observacao_vendedor: observacao })
      .eq('id', lead.id)
      .eq('id_empresa', lead.id_empresa)
      .select('id, observacao_vendedor')
      .maybeSingle();
    setSalvandoObservacao(false);
    if (error || data?.id !== lead.id || data.observacao_vendedor !== observacao) {
      setMensagemObservacao('Não foi possível salvar a observação. Tente novamente.');
      mutacaoEmAndamentoRef.current.liberar();
      return;
    }
    onUpdated({ ...lead, observacao_vendedor: data.observacao_vendedor });
    setMensagemObservacao('Observação salva com sucesso');
    mutacaoEmAndamentoRef.current.liberar();
  }

  const ultimoLogObservacao = logs.find((item) => item.acao.startsWith('observacao_'));

  async function alternarBot() {
    if (!mutacaoEmAndamentoRef.current.tentarAdquirir()) return;
    setAlterandoBot(true);
    setMensagemBot(null);
    const novoEstado = !normalizarBotAtivo(lead.bot_ativo);
    try {
      const response = await fetch(`/api/leads/${lead.id}/ia`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoEstado }),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok || !confirmarTransicaoBot(lead.id, novoEstado, resultado)) {
        throw new Error('Resposta não confirmada.');
      }
      onUpdated({
        ...lead,
        bot_ativo: resultado.bot_ativo,
        bot_ativo_alterado_em: resultado.bot_ativo_alterado_em,
      });
    } catch {
      setMensagemBot('Não foi possível alterar o status da IA. Tente novamente.');
    } finally {
      setAlterandoBot(false);
      mutacaoEmAndamentoRef.current.liberar();
    }
  }

  async function excluirLead() {
    if (!mutacaoEmAndamentoRef.current.tentarAdquirir()) return;
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const response = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
      const resultado = await response.json().catch(() => null);
      if (!response.ok || !confirmarExclusao(lead.id, resultado)) {
        throw new Error('Resposta não confirmada.');
      }
      onDeleted(lead.id);
    } catch {
      setErroExclusao(
        'Não foi possível excluir o lead. Verifique se você tem permissão para esta ação.'
      );
    } finally {
      setExcluindo(false);
      mutacaoEmAndamentoRef.current.liberar();
    }
  }

  async function salvarCampos() {
    if (!mutacaoEmAndamentoRef.current.tentarAdquirir()) return;
    setSalvandoCampos(true);
    setMensagemCampos(null);
    const supabase = createClient();

    const valorNumerico = campos.valor ? Number(campos.valor.replace(',', '.')) : 0;

    const { error } = await supabase
      .from('BASE_DE_LEADS')
      .update({
        cpf: campos.cpf || null,
        data_nascimento: campos.data_nascimento || null,
        veiculo_interesse: campos.veiculo_interesse || null,
        valor: valorNumerico,
        vendedor: campos.vendedor || null,
      })
      .eq('id', lead.id);

    setSalvandoCampos(false);

    if (error) {
      setMensagemCampos('Erro ao salvar alterações.');
      mutacaoEmAndamentoRef.current.liberar();
      return;
    }

    setMensagemCampos('Alterações salvas.');
    onUpdated({
      ...lead,
      cpf: campos.cpf || null,
      data_nascimento: campos.data_nascimento || null,
      veiculo_interesse: campos.veiculo_interesse || null,
      valor: valorNumerico,
      vendedor: campos.vendedor || null,
    });
    mutacaoEmAndamentoRef.current.liberar();
    setTimeout(() => setMensagemCampos(null), 3000);
  }

  const idade = calcularIdade(campos.data_nascimento || null);
  const serasa = classificacaoSerasa(lead.score_serasa);
  const dentroExpediente = isDentroExpediente(new Date(lead.created_at));
  const whatsappUrl = telefoneParaWhatsapp(lead.telefone);
  const botAtivo = normalizarBotAtivo(lead.bot_ativo);
  const ultimaAlteracaoBot = formatarUltimaAlteracaoBot(lead.bot_ativo_alterado_em);
  const mutacaoPendente = salvandoObservacao || alterandoBot || excluindo || salvandoCampos;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <Avatar name={lead.nome_lead} size={44} />
            <div>
              <p className="text-base font-semibold text-foreground">{lead.nome_lead}</p>
              <p className="text-sm text-gray-500">{lead.telefone}</p>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  Abrir WhatsApp
                </a>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${estagioColor}1a`, color: estagioColor }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: estagioColor }} />
                  {estagioLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    dentroExpediente ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${dentroExpediente ? 'bg-green-500' : 'bg-gray-400'}`}
                  />
                  {dentroExpediente ? 'Dentro do expediente' : 'Fora do expediente'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Dados Pessoais
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">CPF</label>
                <input
                  value={campos.cpf}
                  onChange={(e) => setCampos((c) => ({ ...c, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Data de nascimento</label>
                <input
                  type="date"
                  value={campos.data_nascimento}
                  onChange={(e) => setCampos((c) => ({ ...c, data_nascimento: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500">Idade</p>
                <p className="text-sm font-medium text-foreground">{idade !== null ? `${idade} anos` : '—'}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Score Serasa
            </h3>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold text-foreground">{lead.score_serasa ?? '—'}</p>
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `${serasa.color}1a`, color: serasa.color }}
              >
                {serasa.label}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, ((lead.score_serasa ?? 0) / 1000) * 100)}%`,
                  backgroundColor: serasa.color,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>1000</span>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Negociação
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Veículo de interesse</label>
                <input
                  value={campos.veiculo_interesse}
                  onChange={(e) => setCampos((c) => ({ ...c, veiculo_interesse: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  value={campos.valor}
                  onChange={(e) => setCampos((c) => ({ ...c, valor: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Vendedor</label>
                <select
                  value={campos.vendedor}
                  onChange={(e) => setCampos((c) => ({ ...c, vendedor: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Sem vendedor</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.vendedor ?? ''}>
                      {v.vendedor}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-500">Origem</p>
                <p className="text-sm font-medium text-foreground">{lead.origem ?? '—'}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={salvarCampos}
              disabled={salvandoCampos}
              className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {salvandoCampos ? 'Salvando...' : 'Salvar alterações'}
            </button>
            {mensagemCampos && <p className="mt-2 text-xs text-gray-500">{mensagemCampos}</p>}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Etiquetas
            </h3>
            <div className="flex flex-wrap gap-2">
              {etiquetas.map((etiqueta) => {
                const ativa = etiquetasDoLead.has(etiqueta.id);
                return (
                  <button
                    key={etiqueta.id}
                    type="button"
                    onClick={() => toggleEtiqueta(etiqueta.id)}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    style={
                      ativa
                        ? { backgroundColor: `${etiqueta.cor}1a`, borderColor: etiqueta.cor, color: etiqueta.cor }
                        : { backgroundColor: 'white', borderColor: '#e5e7eb', color: '#6b7280' }
                    }
                  >
                    {etiqueta.nome}
                  </button>
                );
              })}
              {etiquetas.length === 0 && (
                <p className="text-xs text-gray-400">Nenhuma etiqueta cadastrada.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Resumo de qualificação [IA]
            </h3>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">
              {lead.resumo_qualificacao?.trim() || (
                <span className="text-gray-400">Nenhum resumo de qualificação disponível ainda.</span>
              )}
            </div>
            <div className="mt-3" aria-live="polite">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  botAtivo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {botAtivo ? 'IA ativa' : 'IA inativa'}
              </span>
              <p className="mt-1 text-xs text-gray-500">
                Última alteração: {ultimaAlteracaoBot}
              </p>
              <button
                type="button"
                onClick={alternarBot}
                disabled={mutacaoPendente}
                aria-pressed={botAtivo}
                className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  botAtivo ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:opacity-90'
                }`}
              >
                {alterandoBot ? 'Alterando IA...' : botAtivo ? 'Desativar IA' : 'Ativar IA'}
              </button>
              {mensagemBot && (
                <p role="status" className="mt-1 text-xs text-red-600">
                  {mensagemBot}
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Observações
            </h3>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Anote observações sobre este lead..."
            />
            <button
              type="button"
              onClick={salvarObservacao}
              disabled={mutacaoPendente}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {salvandoObservacao ? 'Salvando...' : 'Salvar observação'}
            </button>
            {mensagemObservacao && (
              <p
                role="status"
                className={`mt-2 text-xs ${
                  mensagemObservacao === 'Observação salva com sucesso'
                    ? 'text-green-700'
                    : 'text-red-600'
                }`}
              >
                {mensagemObservacao}
              </p>
            )}
            {ultimoLogObservacao && (
              <p className="mt-2 text-xs text-gray-500">
                {ultimoLogObservacao.acao === 'observacao_adicionada' ? 'Adicionada' : 'Alterada'} por {ultimoLogObservacao.responsavel_nome ?? 'Usuário desconhecido'} em {new Date(ultimoLogObservacao.created_at).toLocaleString('pt-BR')}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Histórico de Movimentações
            </h3>
            {historico.length === 0 ? (
              <p className="text-xs text-gray-400">Nenhuma movimentação registrada ainda.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {historico.map((item) => (
                  <li key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-800">
                        {item.estagio_anterior ? `${estagioLabelOf(item.estagio_anterior)} → ` : ''}
                        {estagioLabelOf(item.estagio_novo)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{item.usuario ?? 'Usuário desconhecido'}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Logs gerais</h3>
            {logs.length === 0 ? <p className="text-xs text-gray-400">Nenhuma ação registrada ainda.</p> : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {logs.map((item) => (
                  <li key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex justify-between gap-3"><p className="text-xs font-medium text-gray-800">{item.acao.replaceAll('_', ' ')}</p><time className="shrink-0 text-xs text-gray-400">{new Date(item.created_at).toLocaleString('pt-BR')}</time></div>
                    <p className="mt-0.5 text-xs text-gray-500">{item.responsavel_nome ?? 'Sistema/automação'}</p>
                    {item.detalhes?.campos_alterados?.length ? <p className="mt-1 text-xs text-gray-400">Campos: {item.detalhes.campos_alterados.join(', ')}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-red-700">Excluir lead</h3>
            <p className="mt-1 text-xs text-gray-500">
              Esta ação é permanente e não poderá ser desfeita.
            </p>
            <button
              type="button"
              onClick={() => {
                setErroExclusao(null);
                setConfirmandoExclusao(true);
              }}
              disabled={mutacaoPendente}
              className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              Excluir lead
            </button>
          </section>
        </div>
      </div>

      {confirmandoExclusao && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-exclusao-titulo"
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
          >
            <h2 id="confirmar-exclusao-titulo" className="text-lg font-bold text-foreground">
              Confirmar exclusão
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Tem certeza de que deseja excluir o lead {lead.nome_lead}? Esta ação não poderá ser
              desfeita.
            </p>
            {erroExclusao && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {erroExclusao}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={excluindo}
                onClick={() => setConfirmandoExclusao(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
              >
                Não
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={excluirLead}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {excluindo ? 'Excluindo...' : 'Sim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
