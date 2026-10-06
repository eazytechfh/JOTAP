import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { LeadActivityDates } from '@/lib/lead-period-filter';
import { parseLeadActivityDates } from '@/lib/lead-activity-dates';

export function useLeadActivityDates(enabled: boolean) {
  const [atividadePorLead, setAtividadePorLead] = useState<Map<number, LeadActivityDates>>(new Map());
  const [activityLoading, setActivityLoading] = useState(enabled);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityUpdatedAt, setActivityUpdatedAt] = useState<Date | null>(null);
  const activityRequestRef = useRef(0);

  const refreshActivityDates = useCallback(async () => {
    if (!enabled) return;

    const requestId = ++activityRequestRef.current;
    setActivityLoading(true);
    setActivityError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_lead_activity_dates');
      if (requestId !== activityRequestRef.current) return;
      if (error) {
        console.error('Erro ao buscar atividades dos leads:', error.message);
        setActivityError(error.message);
        return;
      }

      const next = parseLeadActivityDates(data);
      setAtividadePorLead(next);
      setActivityLoaded(true);
      setActivityUpdatedAt(new Date());
    } catch (error) {
      if (requestId !== activityRequestRef.current) return;
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao buscar atividades dos leads:', message);
      setActivityError(message);
    } finally {
      if (requestId === activityRequestRef.current) setActivityLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refreshActivityDates();
    return () => {
      activityRequestRef.current += 1;
    };
  }, [refreshActivityDates]);

  return {
    atividadePorLead,
    activityLoading,
    activityLoaded,
    activityError,
    activityUpdatedAt,
    refreshActivityDates,
  };
}
