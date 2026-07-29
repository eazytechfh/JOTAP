'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Cargo, Etiqueta, PipelineEtapa, Profile, Vendedor } from '@/types/database';
import { Avatar } from '@/components/Avatar';
import { usePipelineEtapas } from '@/hooks/usePipelineEtapas';
import { etapaProtegida, normalizarSlug } from '@/lib/pipeline-etapas';

type Tab = 'novo-usuario' | 'usuarios' | 'etiquetas' | 'etapas' | 'fila' | 'credenciais' | 'aparencia';

const TABS: { id: Tab; label: string }[] = [
  { id: 'novo-usuario', label: 'Criar novo usuário' },
  { id: 'usuarios', label: 'Gerenciar usuários' },
  { id: 'etiquetas', label: 'Etiquetas' },
  { id: 'etapas', label: 'Etapas do pipeline' },
  { id: 'fila', label: 'Fila de atendimento' },
  { id: 'credenciais', label: 'Credenciais' },
  { id: 'aparencia', label: 'Aparência' },
];

function mask(value: string): string {
  if (!value) return '—';
  if (value.length <= 8) return '•'.repeat(value.length);
  return `${value.slice(0, 4)}${'•'.repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>('novo-usuario');
  const [meuProfile, setMeuProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function fetchMeuProfile() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from('profiles')
        .select('id, nome, email, cargo, created_at')
        .eq('id', userData.user.id)
        .single();
      const profile = (data as Profile) ?? null;
      setMeuProfile(profile);
      if (profile?.cargo === 'vendedor') setTab('etiquetas');
    }
    fetchMeuProfile();
  }, []);

  const isAdminMaster = meuProfile?.cargo === 'admin_master';
  const podeGerenciarUsuarios =
    meuProfile?.cargo === 'admin_master' || meuProfile?.cargo === 'admin' || meuProfile?.cargo === 'gerente';

  const visibleTabs = TABS.filter((t) => {
    if (t.id === 'credenciais' || t.id === 'aparencia') return isAdminMaster;
    if (t.id === 'novo-usuario' || t.id === 'usuarios') return podeGerenciarUsuarios;
    if (t.id === 'etapas') return podeGerenciarUsuarios;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'novo-usuario' && <CriarUsuarioTab />}
      {tab === 'usuarios' && <GerenciarUsuariosTab />}
      {tab === 'etiquetas' && <EtiquetasTab />}
      {tab === 'etapas' && podeGerenciarUsuarios && <PipelineEtapasTab />}
      {tab === 'fila' && <FilaAtendimentoTab />}
      {tab === 'credenciais' && isAdminMaster && <CredenciaisTab />}
      {tab === 'aparencia' && isAdminMaster && <AparenciaTab />}
    </div>
  );
}

function PipelineEtapasTab() {
  const { etapas, setEtapas, loadingEtapas, erroEtapas, recarregarEtapas } =
    usePipelineEtapas();
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#3b82f6');
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    const nomeNormalizado = nome.trim();
    const id = normalizarSlug(nomeNormalizado);
    if (!nomeNormalizado || !id) {
      setMensagem('Informe um nome válido.');
      return;
    }

    setOcupado(true);
    setMensagem(null);
    const proximaOrdem = Math.max(0, ...etapas.map((etapa) => etapa.ordem)) + 10;
    const { error } = await supabase.from('pipeline_etapas').insert({
      id,
      nome: nomeNormalizado,
      cor,
      ordem: proximaOrdem,
      ativa: true,
    });

    if (error) {
      setMensagem(
        error.code === '23505'
          ? 'Já existe uma etapa com esse identificador.'
          : error.message
      );
    } else {
      setNome('');
      setMensagem('Etapa criada.');
      await recarregarEtapas();
    }
    setOcupado(false);
  }

  async function salvar(etapa: PipelineEtapa) {
    if (etapaProtegida(etapa.id)) {
      setMensagem('Esta etapa é protegida por automações e não pode ser editada.');
      return;
    }
    if (!etapa.nome.trim()) {
      setMensagem('O nome não pode ficar vazio.');
      return;
    }

    setOcupado(true);
    const { error } = await supabase
      .from('pipeline_etapas')
      .update({ nome: etapa.nome.trim(), cor: etapa.cor })
      .eq('id', etapa.id);
    setMensagem(
      error?.message ?? 'Etapa atualizada. O identificador interno permaneceu estável.'
    );
    if (!error) await recarregarEtapas();
    setOcupado(false);
  }

  async function remover(etapa: PipelineEtapa) {
    if (etapaProtegida(etapa.id)) {
      setMensagem('Esta etapa é protegida por automações e não pode ser removida.');
      return;
    }
    if (!window.confirm(`Excluir a etapa “${etapa.nome}”?`)) return;

    setOcupado(true);
    const { error } = await supabase
      .from('pipeline_etapas')
      .delete()
      .eq('id', etapa.id);
    setMensagem(error?.message ?? 'Etapa excluída.');
    if (!error) await recarregarEtapas();
    setOcupado(false);
  }

  async function mover(index: number, delta: -1 | 1) {
    const destino = index + delta;
    if (destino < 0 || destino >= etapas.length) return;
    if (
      etapaProtegida(etapas[index]?.id) ||
      etapaProtegida(etapas[destino]?.id)
    ) {
      setMensagem('Etapas protegidas não podem ser reordenadas.');
      return;
    }

    const novas = [...etapas];
    [novas[index], novas[destino]] = [novas[destino], novas[index]];
    setEtapas(novas);
    setOcupado(true);
    const { error } = await supabase.rpc('reordenar_pipeline_etapas', {
      p_ids: novas.map((etapa) => etapa.id),
    });
    if (error) {
      setMensagem(error.message);
      await recarregarEtapas();
    } else {
      setMensagem('Ordem atualizada.');
      await recarregarEtapas();
    }
    setOcupado(false);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Etapas do pipeline</h2>
        <p className="mt-1 text-sm text-gray-500">
          Crie etapas e personalize nome, cor e ordem. Etapas usadas por automações
          permanecem protegidas.
        </p>
      </div>

      <form onSubmit={criar} className="flex flex-wrap gap-2 rounded-xl bg-card p-4 shadow-sm">
        <input
          value={nome}
          maxLength={60}
          onChange={(event) => setNome(event.target.value)}
          placeholder="Nova etapa"
          aria-label="Nome da nova etapa"
          className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <input
          type="color"
          value={cor}
          onChange={(event) => setCor(event.target.value)}
          aria-label="Cor da nova etapa"
          className="h-10 w-12 rounded border"
        />
        <button
          type="submit"
          disabled={ocupado || !nome.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Criar
        </button>
      </form>

      {(mensagem || erroEtapas) && (
        <p role="status" className="text-sm text-gray-700">
          {mensagem ?? erroEtapas}
        </p>
      )}

      {loadingEtapas ? (
        <p className="text-sm text-gray-500">Carregando etapas...</p>
      ) : (
        <div className="space-y-2">
          {etapas.map((etapa, index) => {
            const protegida = etapaProtegida(etapa.id);
            return (
              <div
                key={etapa.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3"
              >
                <input
                  disabled={protegida || ocupado}
                  value={etapa.nome}
                  maxLength={60}
                  onChange={(event) =>
                    setEtapas(
                      etapas.map((item) =>
                        item.id === etapa.id ? { ...item, nome: event.target.value } : item
                      )
                    )
                  }
                  aria-label={`Nome da etapa ${etapa.nome}`}
                  className="min-w-[180px] flex-1 rounded border px-2 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500"
                />
                <input
                  disabled={protegida || ocupado}
                  type="color"
                  value={etapa.cor}
                  onChange={(event) =>
                    setEtapas(
                      etapas.map((item) =>
                        item.id === etapa.id ? { ...item, cor: event.target.value } : item
                      )
                    )
                  }
                  aria-label={`Cor da etapa ${etapa.nome}`}
                  className="h-8 w-10"
                />
                {protegida ? (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                    Protegida
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={ocupado || index === 0}
                      onClick={() => void mover(index, -1)}
                      aria-label={`Mover ${etapa.nome} para a esquerda`}
                      className="rounded border px-2 py-1 text-sm disabled:opacity-40"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={ocupado || index === etapas.length - 1}
                      onClick={() => void mover(index, 1)}
                      aria-label={`Mover ${etapa.nome} para a direita`}
                      className="rounded border px-2 py-1 text-sm disabled:opacity-40"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => void salvar(etapa)}
                      className="text-sm font-medium text-blue-600 disabled:opacity-40"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => void remover(etapa)}
                      className="text-sm font-medium text-red-600 disabled:opacity-40"
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CriarUsuarioTab() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargo, setCargo] = useState<Cargo>('vendedor');
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMensagem(null);

    const response = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, password, novoCargo: cargo, telefone }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMensagem({ tipo: 'erro', texto: data.error ?? 'Erro ao criar usuário.' });
      return;
    }

    setMensagem({ tipo: 'sucesso', texto: 'Usuário criado com sucesso.' });
    setNome('');
    setEmail('');
    setPassword('');
    setTelefone('');
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 rounded-xl bg-card p-5 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Nome</label>
        <input
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Senha provisória</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Telefone</label>
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Cargo</label>
        <select
          value={cargo}
          onChange={(e) => setCargo(e.target.value as Cargo)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="vendedor">Vendedor</option>
          <option value="gerente">Gerente</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {mensagem && (
        <p className={`text-sm ${mensagem.tipo === 'erro' ? 'text-red-600' : 'text-green-600'}`}>
          {mensagem.texto}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? 'Criando...' : 'Criar usuário'}
      </button>
    </form>
  );
}

function GerenciarUsuariosTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [linkReset, setLinkReset] = useState<{ email: string; link: string } | null>(null);

  useEffect(() => {
    async function fetchProfiles() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, nome, email, cargo, created_at, desativado')
        .order('created_at', { ascending: false });
      setProfiles((data as Profile[]) ?? []);
      setLoading(false);
    }
    fetchProfiles();
  }, []);

  async function alterarCargo(id: string, novoCargo: Cargo) {
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ cargo: novoCargo }).eq('id', id);
    if (!error) {
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, cargo: novoCargo } : p)));
    } else {
      setMensagemErro('Erro ao alterar cargo.');
    }
  }

  async function alternarAtivo(id: string, desativarAgora: boolean) {
    setAcaoEmAndamento(`ban-${id}`);
    setMensagemErro(null);

    const response = await fetch(`/api/users/${id}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desativar: desativarAgora }),
    });
    const data = await response.json();

    setAcaoEmAndamento(null);

    if (!response.ok) {
      setMensagemErro(data.error ?? 'Erro ao alterar status do usuário.');
      return;
    }

    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, desativado: desativarAgora } : p)));
  }

  async function resetarSenha(id: string, email: string) {
    setAcaoEmAndamento(`reset-${id}`);
    setMensagemErro(null);

    const response = await fetch(`/api/users/${id}/reset-password`, { method: 'POST' });
    const data = await response.json();

    setAcaoEmAndamento(null);

    if (!response.ok) {
      setMensagemErro(data.error ?? 'Erro ao gerar link de redefinição de senha.');
      return;
    }

    setLinkReset({ email, link: data.link });
  }

  if (loading) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="space-y-3">
      {mensagemErro && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{mensagemErro}</p>
      )}

      <div className="overflow-x-auto rounded-xl bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="px-4 py-3">{p.nome ?? '—'}</td>
                <td className="px-4 py-3">{p.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={p.cargo}
                    onChange={(e) => alterarCargo(p.id, e.target.value as Cargo)}
                    disabled={p.cargo === 'admin_master'}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs disabled:opacity-60"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="gerente">Gerente</option>
                    <option value="admin">Admin</option>
                    {p.cargo === 'admin_master' && <option value="admin_master">Admin Master</option>}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.desativado ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                    }`}
                  >
                    {p.desativado ? 'Desativado' : 'Ativo'}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    type="button"
                    onClick={() => resetarSenha(p.id, p.email)}
                    disabled={acaoEmAndamento === `reset-${p.id}`}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
                  >
                    {acaoEmAndamento === `reset-${p.id}` ? 'Gerando...' : 'Resetar senha'}
                  </button>
                  <button
                    type="button"
                    onClick={() => alternarAtivo(p.id, !p.desativado)}
                    disabled={acaoEmAndamento === `ban-${p.id}` || p.cargo === 'admin_master'}
                    className={`rounded-lg border px-2 py-1 text-xs disabled:opacity-60 ${
                      p.desativado
                        ? 'border-green-300 text-green-600 hover:bg-green-50'
                        : 'border-red-300 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {acaoEmAndamento === `ban-${p.id}`
                      ? 'Aplicando...'
                      : p.desativado
                        ? 'Reativar'
                        : 'Desativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {linkReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setLinkReset(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-sm font-semibold text-foreground">Link de redefinição de senha</h3>
            <p className="mb-3 text-xs text-gray-500">
              Envie este link para <strong>{linkReset.email}</strong>. Ele expira após o primeiro uso.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={linkReset.link}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(linkReset.link)}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white"
              >
                Copiar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLinkReset(null)}
              className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EtiquetasTab() {
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#3b82f6');

  useEffect(() => {
    async function fetchEtiquetas() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.from('etiquetas').select('id, nome, cor, created_at').order('id');
      setEtiquetas((data as Etiqueta[]) ?? []);
      setLoading(false);
    }
    fetchEtiquetas();
  }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('etiquetas')
      .insert({ nome, cor })
      .select('id, nome, cor, created_at')
      .single();
    if (!error && data) {
      setEtiquetas((prev) => [...prev, data as Etiqueta]);
      setNome('');
    }
  }

  async function remover(id: number) {
    const supabase = createClient();
    const { error } = await supabase.from('etiquetas').delete().eq('id', id);
    if (!error) {
      setEtiquetas((prev) => prev.filter((e) => e.id !== id));
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <form onSubmit={adicionar} className="flex items-end gap-2 rounded-xl bg-card p-4 shadow-sm">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cor</label>
          <input
            type="color"
            value={cor}
            onChange={(e) => setCor(e.target.value)}
            className="h-10 w-14 rounded-lg border border-gray-300"
          />
        </div>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
          Adicionar
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : (
        <ul className="space-y-2">
          {etiquetas.map((etq) => (
            <li
              key={etq.id}
              className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: etq.cor }} />
                <span className="text-sm text-gray-800">{etq.nome}</span>
              </div>
              <button
                type="button"
                onClick={() => remover(etq.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilaAtendimentoTab() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFila() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('VENDEDORES')
        .select('id, created_at, vendedor, telefone, atender, quantos_lead, id_click, id_empresa')
        .order('id', { ascending: true });

      if (error) {
        console.error('Erro ao buscar fila de atendimento:', error.message);
        setVendedores([]);
      } else {
        setVendedores((data as Vendedor[]) ?? []);
      }
      setLoading(false);
    }
    fetchFila();
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Carregando...</p>;

  // A coluna "atender" da tabela VENDEDORES indica a posição de cada vendedor na fila de
  // distribuição de leads: "vez" é quem recebe o próximo lead, "espera" é quem está aguardando
  // a próxima rodada. A ordem de espera segue o id de cadastro (não há coluna de posição
  // explícita na tabela hoje).
  const normalizado = (v: string | null) => (v ?? '').toLowerCase().trim();
  const daVez = vendedores.filter((v) => normalizado(v.atender) === 'vez');
  const emEspera = vendedores.filter((v) => normalizado(v.atender) === 'espera');
  const outros = vendedores.filter(
    (v) => !['vez', 'espera'].includes(normalizado(v.atender))
  );

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Vendedor da vez
        </h2>
        {daVez.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum vendedor está marcado como &quot;vez&quot; agora.</p>
        ) : (
          <div className="space-y-2">
            {daVez.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4"
              >
                <Avatar name={v.vendedor ?? '?'} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{v.vendedor}</p>
                  <p className="text-xs text-gray-500">{v.telefone ?? '—'}</p>
                </div>
                <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white">
                  Na vez
                </span>
                <span className="text-xs text-gray-500">{v.quantos_lead ?? 0} leads</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Em espera
        </h2>
        {emEspera.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum vendedor em espera.</p>
        ) : (
          <ol className="space-y-2">
            {emEspera.map((v, index) => (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-card p-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                  {index + 1}
                </span>
                <Avatar name={v.vendedor ?? '?'} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{v.vendedor}</p>
                  <p className="text-xs text-gray-500">{v.telefone ?? '—'}</p>
                </div>
                <span className="text-xs text-gray-500">{v.quantos_lead ?? 0} leads</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {outros.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Sem status de fila definido
          </h2>
          <ul className="space-y-2">
            {outros.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
              >
                <Avatar name={v.vendedor ?? '?'} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{v.vendedor}</p>
                  <p className="text-xs text-gray-500">{v.telefone ?? '—'}</p>
                </div>
                <span className="text-xs text-gray-400">atender: {v.atender ?? '—'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vendedores.length === 0 && (
        <p className="text-sm text-gray-400">Nenhum vendedor cadastrado ainda.</p>
      )}
    </div>
  );
}

function CredenciaisTab() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const [uazapiToken, setUazapiToken] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [qrcode, setQrcode] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [statusConexao, setStatusConexao] = useState<string | null>(null);
  const [instanceStatus, setInstanceStatus] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function checarStatus() {
    const response = await fetch('/api/whatsapp/status');
    const data = await response.json();
    if (response.ok) setInstanceStatus(data.status ?? null);
  }

  useEffect(() => {
    async function fetchSettings() {
      const supabase = createClient();
      const { data } = await supabase
        .from('app_settings')
        .select('uazapi_token, uazapi_base_url')
        .eq('id', 1)
        .single();
      const token = (data as { uazapi_token: string | null } | null)?.uazapi_token;
      setUazapiToken(token ?? '');
      if (token) checarStatus();
    }
    fetchSettings();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function salvarToken() {
    setSalvando(true);
    setMensagem(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('app_settings')
      .update({ uazapi_token: uazapiToken, updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSalvando(false);
    setMensagem(error ? 'Erro ao salvar token.' : 'Token salvo com sucesso.');
  }

  async function conectarWhatsapp() {
    setConectando(true);
    setQrcode(null);
    setStatusConexao(null);

    const response = await fetch('/api/whatsapp/connect', { method: 'POST' });
    const data = await response.json();

    if (!response.ok) {
      setStatusConexao(data.error ?? 'Erro ao conectar.');
      setConectando(false);
      return;
    }

    setQrcode(data.qrcode);

    // Polling de status até a instância ficar conectada, com timeout de 60s para não rodar
    // indefinidamente caso o usuário nunca escaneie o QR code.
    const startedAt = Date.now();
    const TIMEOUT_MS = 60_000;

    pollingRef.current = setInterval(async () => {
      if (Date.now() - startedAt > TIMEOUT_MS) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setConectando(false);
        setStatusConexao('Tempo esgotado. Tente novamente.');
        return;
      }

      const statusResponse = await fetch('/api/whatsapp/status');
      const statusData = await statusResponse.json();

      if (statusResponse.ok && statusData.status === 'connected') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setConectando(false);
        setStatusConexao('Conectado com sucesso.');
        setInstanceStatus('connected');
        setQrcode(null);
      }
    }, 3000);
  }

  async function desconectarWhatsapp() {
    setDesconectando(true);
    setStatusConexao(null);

    const response = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
    const data = await response.json();

    setDesconectando(false);

    if (!response.ok) {
      setStatusConexao(data.error ?? 'Erro ao desconectar.');
      return;
    }

    setInstanceStatus('disconnected');
    setStatusConexao('Desconectado com sucesso.');
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="rounded-xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Supabase</h2>
        <p className="text-xs text-gray-500">URL</p>
        <p className="mb-2 text-sm text-gray-800">{mask(supabaseUrl)}</p>
        <p className="text-xs text-gray-500">Anon Key</p>
        <p className="text-sm text-gray-800">{mask(supabaseAnonKey)}</p>
      </div>

      <div className="rounded-xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Token uazapi</h2>
        <input
          value={uazapiToken}
          onChange={(e) => setUazapiToken(e.target.value)}
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Token da instância uazapi"
        />
        <button
          type="button"
          onClick={salvarToken}
          disabled={salvando}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Salvar token'}
        </button>
        {mensagem && <p className="mt-2 text-xs text-gray-500">{mensagem}</p>}
      </div>

      <div className="rounded-xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">WhatsApp</h2>
        <p className="mb-3 text-xs text-gray-500">
          Status:{' '}
          <span
            className={
              instanceStatus === 'connected'
                ? 'font-medium text-green-600'
                : instanceStatus === 'connecting'
                  ? 'font-medium text-amber-600'
                  : 'font-medium text-gray-600'
            }
          >
            {instanceStatus === 'connected'
              ? 'Conectado'
              : instanceStatus === 'connecting'
                ? 'Conectando'
                : instanceStatus === 'disconnected'
                  ? 'Desconectado'
                  : 'Desconhecido'}
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={conectarWhatsapp}
            disabled={conectando || instanceStatus === 'connected'}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {conectando ? 'Conectando...' : 'Conectar WhatsApp'}
          </button>
          {instanceStatus === 'connected' && (
            <button
              type="button"
              onClick={desconectarWhatsapp}
              disabled={desconectando}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-60"
            >
              {desconectando ? 'Desconectando...' : 'Desconectar'}
            </button>
          )}
        </div>
        {statusConexao && <p className="mt-2 text-xs text-gray-500">{statusConexao}</p>}
      </div>

      {qrcode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setQrcode(null)}
        >
          <div className="rounded-xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm text-gray-700">Escaneie o QR code com o WhatsApp</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem base64 dinâmica do QR code, não compatível com otimização do next/image */}
            <img src={qrcode} alt="QR code de conexão do WhatsApp" className="mx-auto h-64 w-64" />
            <button
              type="button"
              onClick={() => setQrcode(null)}
              className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AparenciaTab() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [corPrimaria, setCorPrimaria] = useState('#111827');
  const [corSecundaria, setCorSecundaria] = useState('#3b82f6');
  const [corTexto, setCorTexto] = useState('#111827');
  const [corFundo, setCorFundo] = useState('#f5f6f8');

  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [salvandoCores, setSalvandoCores] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);

  useEffect(() => {
    async function fetchAtual() {
      const supabase = createClient();
      const { data } = await supabase
        .from('app_settings')
        .select('logo_url, cor_primaria, cor_secundaria, cor_texto, cor_fundo')
        .eq('id', 1)
        .single();
      const atual = data as {
        logo_url: string | null;
        cor_primaria: string;
        cor_secundaria: string;
        cor_texto: string;
        cor_fundo: string;
      } | null;
      if (!atual) return;
      setLogoUrl(atual.logo_url);
      setCorPrimaria(atual.cor_primaria);
      setCorSecundaria(atual.cor_secundaria);
      setCorTexto(atual.cor_texto);
      setCorFundo(atual.cor_fundo);
    }
    fetchAtual();
  }, []);

  // Aplica as cores no documento imediatamente (sem esperar reload), para o admin master ver o
  // resultado em tempo real enquanto ajusta. Outros usuários recebem o valor salvo no próximo
  // carregamento de página, via RootLayout (que lê direto do banco).
  function aplicarPreview(vars: Record<string, string>) {
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }

  async function handleUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setEnviandoLogo(true);
    setMensagem(null);

    const supabase = createClient();
    const path = `logo-${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (uploadError) {
      setEnviandoLogo(false);
      setMensagem({ tipo: 'erro', texto: 'Erro ao enviar logo.' });
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(path);
    const novaUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from('app_settings')
      .update({ logo_url: novaUrl, updated_at: new Date().toISOString() })
      .eq('id', 1);

    setEnviandoLogo(false);

    if (updateError) {
      setMensagem({ tipo: 'erro', texto: 'Logo enviada, mas houve erro ao salvar.' });
      return;
    }

    setLogoUrl(novaUrl);
    setMensagem({ tipo: 'sucesso', texto: 'Logo atualizada com sucesso.' });
  }

  async function salvarCores() {
    setSalvandoCores(true);
    setMensagem(null);

    const supabase = createClient();
    const { error } = await supabase
      .from('app_settings')
      .update({
        cor_primaria: corPrimaria,
        cor_secundaria: corSecundaria,
        cor_texto: corTexto,
        cor_fundo: corFundo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    setSalvandoCores(false);

    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar cores.' });
      return;
    }

    aplicarPreview({
      '--color-primaria': corPrimaria,
      '--color-secundaria': corSecundaria,
      '--color-texto': corTexto,
      '--color-fundo': corFundo,
    });
    setMensagem({ tipo: 'sucesso', texto: 'Cores salvas. Outros usuários verão a mudança ao recarregar a página.' });
  }

  return (
    <div className="max-w-md space-y-6">
      <div className="rounded-xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Logo do cliente</h2>
        {logoUrl && (
          <div className="mb-3 inline-flex h-20 max-w-[280px] items-center justify-center overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview de URL dinâmica do Storage */}
            <img src={logoUrl} alt="Logo atual" className="h-full w-full object-contain" />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleUploadLogo}
          disabled={enviandoLogo}
          className="block w-full text-sm text-gray-600"
        />
        {enviandoLogo && <p className="mt-2 text-xs text-gray-500">Enviando...</p>}
      </div>

      <div className="rounded-xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Cores do sistema</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Cor primária (botões, destaque)</label>
            <input
              type="color"
              value={corPrimaria}
              onChange={(e) => setCorPrimaria(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-gray-300"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Cor secundária (acentos)</label>
            <input
              type="color"
              value={corSecundaria}
              onChange={(e) => setCorSecundaria(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-gray-300"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Cor do texto</label>
            <input
              type="color"
              value={corTexto}
              onChange={(e) => setCorTexto(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-gray-300"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Cor de fundo</label>
            <input
              type="color"
              value={corFundo}
              onChange={(e) => setCorFundo(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-gray-300"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={salvarCores}
          disabled={salvandoCores}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {salvandoCores ? 'Salvando...' : 'Salvar cores'}
        </button>
      </div>

      {mensagem && (
        <p className={`text-sm ${mensagem.tipo === 'erro' ? 'text-red-600' : 'text-green-600'}`}>
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
