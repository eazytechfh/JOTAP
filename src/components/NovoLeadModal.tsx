'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { BaseDeLeads, Vendedor } from '@/types/database';
import { usePipelineEtapas } from '@/hooks/usePipelineEtapas';

// Campos como "Etapa", QuemEnviouMsg, UltimaMensagem, Status de Follow, Transferencia,
// Pesquisa de satisfação, ID CONTATO CLICK, lid, Data e Hora e bot_ativo são preenchidos pela
// automação de WhatsApp/bot (n8n/uazapi), não fazem sentido num formulário de criação manual e
// por isso não aparecem aqui.

const ORIGENS = ['whatsapp', 'instagram', 'facebook', 'site', 'indicacao'];

interface FormState {
  nome_lead: string;
  telefone: string;
  email: string;
  origem: string;
  vendedor: string;
  veiculo_interesse: string;
  valor: string;
  cpf: string;
  data_nascimento: string;
  score_serasa: string;
  estagio_lead: string;
  resumo_comercial: string;
  observacao_vendedor: string;
}

const FORM_INICIAL: FormState = {
  nome_lead: '',
  telefone: '',
  email: '',
  origem: '',
  vendedor: '',
  veiculo_interesse: '',
  valor: '',
  cpf: '',
  data_nascimento: '',
  score_serasa: '',
  estagio_lead: 'oportunidade',
  resumo_comercial: '',
  observacao_vendedor: '',
};

interface NovoLeadModalProps {
  onClose: () => void;
  onCreated: (lead: BaseDeLeads) => void;
}

export function NovoLeadModal({ onClose, onCreated }: NovoLeadModalProps) {
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { etapas } = usePipelineEtapas();

  useEffect(() => {
    let isMounted = true;
    async function fetchVendedores() {
      const supabase = createClient();
      const { data } = await supabase
        .from('VENDEDORES')
        .select('id, created_at, vendedor, telefone, atender, quantos_lead, id_click, id_empresa')
        .order('vendedor');
      if (isMounted) setVendedores((data as Vendedor[]) ?? []);
    }
    fetchVendedores();
    return () => {
      isMounted = false;
    };
  }, []);

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  async function salvar() {
    if (!form.nome_lead.trim() || !form.telefone.trim()) {
      setErro('Nome e telefone são obrigatórios.');
      return;
    }

    setSalvando(true);
    setErro(null);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('BASE_DE_LEADS')
      .insert({
        // CRM é single-tenant: todo lead existente tem id_empresa = 1 (coluna NOT NULL sem
        // default no banco), então fixamos o mesmo valor aqui.
        id_empresa: 1,
        nome_lead: form.nome_lead.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim() || null,
        origem: form.origem || null,
        vendedor: form.vendedor || null,
        veiculo_interesse: form.veiculo_interesse.trim() || null,
        valor: form.valor ? Number(form.valor.replace(',', '.')) : null,
        cpf: form.cpf.trim() || null,
        data_nascimento: form.data_nascimento || null,
        score_serasa: form.score_serasa ? Number(form.score_serasa) : null,
        estagio_lead: form.estagio_lead,
        resumo_comercial: form.resumo_comercial.trim() || null,
        observacao_vendedor: form.observacao_vendedor.trim() || null,
      })
      .select('*')
      .single();

    setSalvando(false);

    if (error || !data) {
      setErro(error?.message ?? 'Erro ao criar lead.');
      return;
    }

    onCreated(data as unknown as BaseDeLeads);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Novo lead</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {erro && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Nome *</label>
            <input
              value={form.nome_lead}
              onChange={(e) => set('nome_lead', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Telefone *</label>
            <input
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="5599999999999"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Origem</label>
            <select
              value={form.origem}
              onChange={(e) => set('origem', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Selecione</option>
              {ORIGENS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Vendedor</label>
            <select
              value={form.vendedor}
              onChange={(e) => set('vendedor', e.target.value)}
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
            <label className="mb-1 block text-xs text-gray-500">Estágio inicial</label>
            <select
              value={form.estagio_lead}
              onChange={(e) => set('estagio_lead', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            >
              {etapas.map((etapa) => (
                <option key={etapa.id} value={etapa.id}>
                  {etapa.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Veículo de interesse</label>
            <input
              value={form.veiculo_interesse}
              onChange={(e) => set('veiculo_interesse', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Valor</label>
            <input
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => set('valor', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">CPF</label>
            <input
              value={form.cpf}
              onChange={(e) => set('cpf', e.target.value)}
              placeholder="000.000.000-00"
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Data de nascimento</label>
            <input
              type="date"
              value={form.data_nascimento}
              onChange={(e) => set('data_nascimento', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Score Serasa</label>
            <input
              type="number"
              value={form.score_serasa}
              onChange={(e) => set('score_serasa', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-gray-500">Resumo comercial</label>
            <textarea
              value={form.resumo_comercial}
              onChange={(e) => set('resumo_comercial', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-gray-500">Observação do vendedor</label>
            <textarea
              value={form.observacao_vendedor}
              onChange={(e) => set('observacao_vendedor', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {salvando ? 'Criando...' : 'Criar lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
