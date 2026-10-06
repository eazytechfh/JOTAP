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
    .eq('estagio_lead', 'em_negociacao')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + 999);
  if (result.error) throw new Error(result.error.message);
  rows.push(...result.data);
  if (result.data.length < 1000) break;
}

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 6);
cutoff.setHours(0, 0, 0, 0);
const recent = rows.filter((row) => new Date(row.created_at) >= cutoff);
const seen = new Set();
const deduplicated = rows.filter((row) => {
  let phone = String(row.telefone ?? '').replace(/\D/g, '');
  if (phone.length > 11 && phone.startsWith('55')) phone = phone.slice(2);
  const email = String(row.email ?? '').trim().toLocaleLowerCase('pt-BR');
  const keyValue = phone ? `phone:${phone}` : email ? `email:${email}` : `id:${row.id}`;
  if (seen.has(keyValue)) return false;
  seen.add(keyValue);
  return true;
});
const summarize = (items) => ({
  leads: items.length,
  with_value: items.filter((row) => row.valor !== null && row.valor !== '').length,
  numeric_values: items.filter((row) => Number.isFinite(Number(row.valor))).length,
  positive_values: items.filter((row) => Number(row.valor) > 0).length,
  sum: items.reduce((sum, row) => sum + (Number.isFinite(Number(row.valor)) ? Number(row.valor) : 0), 0),
  stored_types: [...new Set(items.filter((row) => row.valor !== null).map((row) => typeof row.valor))],
});

console.log(JSON.stringify({ all_time: summarize(rows), displayed_after_deduplication: summarize(deduplicated), last_7_days: summarize(recent) }, null, 2));
