'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ETAPAS_FALLBACK } from '@/lib/pipeline-etapas';
import type { PipelineEtapa } from '@/types/database';

export function usePipelineEtapas() {
  const [etapas, setEtapas] = useState<PipelineEtapa[]>(ETAPAS_FALLBACK);
  const [loadingEtapas, setLoadingEtapas] = useState(true);
  const [erroEtapas, setErroEtapas] = useState<string | null>(null);

  const recarregarEtapas = useCallback(async () => {
    setLoadingEtapas(true);
    const { data, error } = await createClient()
      .from('pipeline_etapas')
      .select('id, nome, ordem, cor, ativa')
      .eq('ativa', true)
      .order('ordem', { ascending: true });

    if (error) {
      setEtapas(ETAPAS_FALLBACK);
      setErroEtapas(error.message);
    } else {
      const recebidas = (data as PipelineEtapa[] | null) ?? [];
      setEtapas(recebidas.length ? recebidas : ETAPAS_FALLBACK);
      setErroEtapas(null);
    }
    setLoadingEtapas(false);
  }, []);

  useEffect(() => {
    void recarregarEtapas();
  }, [recarregarEtapas]);

  return {
    etapas,
    setEtapas,
    loadingEtapas,
    erroEtapas,
    recarregarEtapas,
  };
}
