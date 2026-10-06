'use client';

import { useState } from 'react';
import { REDISTRIBUIR_IGUALMENTE } from '@/lib/vendedores/redistribuicao';

type Destino = { id: string | number; nome: string };

type Props = {
  vendedorNome: string;
  destinos: Destino[];
  loading: boolean;
  onCancel: () => void;
  onConfirm: (redistribuirPara: string | null) => void;
};

export function ExcluirVendedorModal({ vendedorNome, destinos, loading, onCancel, onConfirm }: Props) {
  const [destino, setDestino] = useState('');
  const semDestino = destino === '';
  const distribuicaoIgual = destino === REDISTRIBUIR_IGUALMENTE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="excluir-vendedor-titulo"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900"
      >
        <h2 id="excluir-vendedor-titulo" className="text-lg font-semibold text-foreground">
          Excluir vendedor?
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          O vendedor <strong>{vendedorNome}</strong> será excluído permanentemente. Escolha o que
          fazer com todos os leads atribuídos a {vendedorNome}.
        </p>

        <label className="mt-5 block text-sm font-medium text-foreground" htmlFor="destino-leads">
          Redistribuir leads para
        </label>
        <select
          id="destino-leads"
          value={destino}
          onChange={(event) => setDestino(event.target.value)}
          disabled={loading}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="">Sem vendedor</option>
          {destinos.length > 0 && (
            <option value={REDISTRIBUIR_IGUALMENTE}>Distribuir igualmente entre os outros</option>
          )}
          {destinos.map((item) => (
            <option key={item.id} value={item.nome}>
              {item.nome}
            </option>
          ))}
        </select>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-60 dark:border-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(semDestino ? null : destino)}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading
              ? 'Excluindo...'
              : semDestino
                ? 'Deixar sem vendedor e excluir'
                : distribuicaoIgual
                  ? 'Distribuir igualmente e excluir'
                  : 'Redistribuir e excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
