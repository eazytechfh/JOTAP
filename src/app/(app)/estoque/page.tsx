'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { Estoque } from '@/types/database';
import { AutomotiveLoading } from '@/components/AutomotiveLoading';

const STATUS_ESTOQUE = ['Disponível', 'Indisponível', 'Vendido'] as const;

function getImagens(veiculo: Estoque): string[] {
  return [veiculo.linkImagem0, veiculo.linkImagem1, veiculo.linkImagem2, veiculo.linkImagem3].filter(
    (v): v is string => Boolean(v)
  );
}

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
      <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10">
        <path
          d="M3 11l2-6h14l2 6M5 11h14v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="18" r="1" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="18" r="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function EstoquePage() {
  const [veiculos, setVeiculos] = useState<Estoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [marcaFiltro, setMarcaFiltro] = useState('todas');
  const [statusFiltro, setStatusFiltro] = useState('Disponível');
  const [salvandoStatus, setSalvandoStatus] = useState(false);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Estoque | null>(null);
  const [imagemIndex, setImagemIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchEstoque() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('estoque')
        .select(
          'id, marca, modelo, ano, cor, combustivel, quilometragem, status, created_at, updated_at, placa, "link imagem 0", valor, "link imagem 1", "link imagem 2", "link imagem 3", "ID VEICULO", tipo'
        )
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error('Erro ao buscar estoque:', error.message);
        setVeiculos([]);
      } else {
        // O Supabase retorna as chaves reais (com espaço/acento); mapeamos manualmente para os
        // nomes de campo da interface TypeScript Estoque.
        const mapped = ((data as unknown[]) ?? []).map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: r.id,
            marca: r.marca,
            modelo: r.modelo,
            ano: r.ano,
            cor: r.cor,
            combustivel: r.combustivel,
            quilometragem: r.quilometragem,
            status: r.status,
            created_at: r.created_at,
            updated_at: r.updated_at,
            placa: r.placa,
            linkImagem0: r['link imagem 0'],
            valor: r.valor,
            motor: null,
            linkImagem1: r['link imagem 1'],
            linkImagem2: r['link imagem 2'],
            linkImagem3: r['link imagem 3'],
            idVeiculo: r['ID VEICULO'],
            tipo: r.tipo,
          } as Estoque;
        });
        setVeiculos(mapped);
      }
      setLoading(false);
    }

    fetchEstoque();
    return () => {
      isMounted = false;
    };
  }, []);

  const marcasDisponiveis = useMemo(
    () => Array.from(new Set(veiculos.map((v) => v.marca).filter((v): v is string => Boolean(v)))),
    [veiculos]
  );
  const statusDisponiveis = useMemo(
    () => Array.from(new Set(veiculos.map((v) => v.status).filter(Boolean))),
    [veiculos]
  );

  const veiculosFiltrados = useMemo(() => {
    return veiculos.filter((v) => {
      if (busca) {
        const term = busca.toLowerCase();
        const matches =
          v.marca?.toLowerCase().includes(term) ||
          v.modelo?.toLowerCase().includes(term) ||
          v.placa?.toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (marcaFiltro !== 'todas' && v.marca !== marcaFiltro) return false;
      if (statusFiltro !== 'todos' && v.status !== statusFiltro) return false;
      return true;
    });
  }, [veiculos, busca, marcaFiltro, statusFiltro]);

  function abrirModal(veiculo: Estoque) {
    setSelecionado(veiculo);
    setImagemIndex(0);
  }

  async function atualizarStatus(status: (typeof STATUS_ESTOQUE)[number]) {
    if (!selecionado) return;
    setSalvandoStatus(true);
    setErroStatus(null);
    const { data, error } = await createClient().from('estoque').update({ status }).eq('id', selecionado.id).select('id, status').single();
    setSalvandoStatus(false);
    if (error || data?.status !== status) {
      setErroStatus('Não foi possível alterar o status do veículo.');
      return;
    }
    const atualizado = { ...selecionado, status };
    setSelecionado(atualizado);
    setVeiculos((prev) => prev.map((item) => item.id === atualizado.id ? atualizado : item));
  }

  const imagensModal = selecionado ? getImagens(selecionado) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
        <p className="text-sm text-gray-500">{veiculosFiltrados.length} veículo(s) encontrado(s)</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por marca, modelo ou placa..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          value={marcaFiltro}
          onChange={(e) => setMarcaFiltro(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="todas">Todas as marcas</option>
          {marcasDisponiveis.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="todos">Todos os status</option>
          {Array.from(new Set([...STATUS_ESTOQUE, ...statusDisponiveis])).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <AutomotiveLoading label="Carregando estoque" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {veiculosFiltrados.map((veiculo) => {
            const imagens = getImagens(veiculo);
            const primeiraImagem = imagens[0];
            return (
              <button
                key={veiculo.id}
                type="button"
                onClick={() => abrirModal(veiculo)}
                className="overflow-hidden rounded-xl bg-card text-left shadow-sm transition hover:shadow-md"
              >
                <div className="relative h-40 w-full bg-gray-100">
                  {primeiraImagem ? (
                    // unoptimized: as URLs vêm de fontes arbitrárias cadastradas manualmente no
                    // banco (sem controle sobre o domínio/CDN), então desativamos a otimização do
                    // Next/Image para evitar falhas de otimização em hosts não previstos e
                    // simplificar a configuração de remotePatterns.
                    <Image
                      src={primeiraImagem}
                      alt={`${veiculo.marca ?? ''} ${veiculo.modelo ?? ''}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <Placeholder />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {veiculo.marca} {veiculo.modelo}
                  </p>
                  <p className="text-xs text-gray-500">
                    {veiculo.ano ?? '—'} · {veiculo.cor ?? '—'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{veiculo.valor ?? '—'}</p>
                </div>
              </button>
            );
          })}
          {veiculosFiltrados.length === 0 && (
            <p className="text-sm text-gray-400">Nenhum veículo encontrado.</p>
          )}
        </div>
      )}

      {selecionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelecionado(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mb-4 h-64 w-full overflow-hidden rounded-lg bg-gray-100">
              {imagensModal.length > 0 ? (
                <Image
                  src={imagensModal[imagemIndex]}
                  alt="Foto do veículo"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <Placeholder />
              )}

              {imagensModal.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setImagemIndex((i) => (i === 0 ? imagensModal.length - 1 : i - 1))
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-sm shadow"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setImagemIndex((i) => (i === imagensModal.length - 1 ? 0 : i + 1))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-sm shadow"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            <h2 className="text-lg font-bold text-foreground">
              {selecionado.marca} {selecionado.modelo}
            </h2>
            <p className="text-sm text-gray-500">
              {selecionado.ano} · {selecionado.cor} · {selecionado.combustivel}
            </p>
            <p className="mt-2 text-sm text-gray-700">Placa: {selecionado.placa ?? '—'}</p>
            <p className="text-sm text-gray-700">
              Quilometragem: {selecionado.quilometragem ?? '—'} km
            </p>
            <p className="text-sm text-gray-700">Motor: {selecionado.motor ?? '—'}</p>
            <p className="mt-2 text-lg font-bold text-foreground">{selecionado.valor ?? '—'}</p>
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium text-gray-700">Status do veículo</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {STATUS_ESTOQUE.map((status) => (
                  <button key={status} type="button" disabled={salvandoStatus || selecionado.status === status} onClick={() => atualizarStatus(status)} className="rounded-lg border px-2 py-2 text-xs font-medium disabled:bg-gray-100 disabled:opacity-60">{status}</button>
                ))}
              </div>
              {erroStatus && <p role="status" className="mt-2 text-xs text-red-600">{erroStatus}</p>}
            </div>

            <button
              type="button"
              onClick={() => setSelecionado(null)}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
