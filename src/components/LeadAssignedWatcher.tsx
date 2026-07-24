'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const INTERVALO_FALLBACK_MS = 180_000;
const EVENTO_ATRIBUICOES = 'lead-assignments-changed';

export function LeadAssignedWatcher({ sellerName }: { sellerName: string }) {
  const idsAtribuidos = useRef<Set<number>>(new Set());
  const inicializado = useRef(false);

  useEffect(() => {
    if (!sellerName.trim()) return;
    const supabase = createClient();
    let active = true;

    async function verificarAtribuicoes(tocarNovas: boolean) {
      const { data, error } = await supabase
        .from('BASE_DE_LEADS')
        .select('id')
        .eq('vendedor', sellerName);
      if (!active || error) return;

      const atuais = new Set(((data as { id: number }[]) ?? []).map((lead) => lead.id));
      const recebeuNovo =
        inicializado.current &&
        Array.from(atuais).some((id) => !idsAtribuidos.current.has(id));
      const atribuicoesMudaram =
        inicializado.current &&
        (atuais.size !== idsAtribuidos.current.size ||
          Array.from(atuais).some((id) => !idsAtribuidos.current.has(id)));

      idsAtribuidos.current = atuais;
      inicializado.current = true;

      if (atribuicoesMudaram) {
        window.dispatchEvent(new CustomEvent(EVENTO_ATRIBUICOES));
      }
      if (tocarNovas && recebeuNovo) {
        try {
          const audio = new Audio('/effects/lead-assigned.mp3');
          audio.preload = 'auto';
          audio.volume = 0.86;
          await audio.play();
        } catch {
          // Uma aba sem interação pode bloquear autoplay; a atribuição continua válida.
        }
      }
    }

    void verificarAtribuicoes(false);
    const channel = supabase
      .channel(`lead-assigned-${sellerName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'BASE_DE_LEADS' },
        () => void verificarAtribuicoes(true)
      )
      .subscribe();
    const interval = window.setInterval(
      () => void verificarAtribuicoes(true),
      INTERVALO_FALLBACK_MS
    );

    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [sellerName]);

  return null;
}
