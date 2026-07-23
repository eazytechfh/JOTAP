import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Variáveis obrigatórias ausentes.');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const rows = [];
for (let from = 0; ; from += 1000) {
  const result = await db.from('BASE_DE_LEADS')
    .select('id, telefone, email, estagio_lead, valor, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + 999);
  if (result.error) throw new Error(result.error.message);
  rows.push(...result.data);
  if (result.data.length < 1000) break;
}

const positive = rows.filter((row) => Number.isFinite(Number(row.valor)) && Number(row.valor) > 0);
const byStage = positive.reduce((acc, row) => {
  const stage = row.estagio_lead || 'sem_estagio';
  acc[stage] ??= { leads: 0, sum: 0 };
  acc[stage].leads += 1;
  acc[stage].sum += Number(row.valor);
  return acc;
}, {});

const seen = new Set();
const displayed = rows.filter((row) => {
  let phone = String(row.telefone ?? '').replace(/\D/g, '');
  if (phone.length > 11 && phone.startsWith('55')) phone = phone.slice(2);
  const email = String(row.email ?? '').trim().toLocaleLowerCase('pt-BR');
  const identity = phone ? `phone:${phone}` : email ? `email:${email}` : `id:${row.id}`;
  if (seen.has(identity)) return false;
  seen.add(identity);
  return true;
});
const displayedPositive = displayed.filter((row) => Number(row.valor) > 0);

console.log(JSON.stringify({
  total_leads: rows.length,
  leads_with_positive_value: positive.length,
  positive_value_rows_with_valid_id: positive.filter((row) => row.id !== null && row.id !== undefined).length,
  unique_ids_with_positive_value: new Set(positive.map((row) => row.id)).size,
  total_positive_value: positive.reduce((sum, row) => sum + Number(row.valor), 0),
  positive_values_by_stage: byStage,
  after_display_deduplication: {
    leads_with_positive_value: displayedPositive.length,
    total_positive_value: displayedPositive.reduce((sum, row) => sum + Number(row.valor), 0),
  },
}, null, 2));
