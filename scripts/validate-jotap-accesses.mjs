import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error('Variáveis obrigatórias ausentes.');

const adminDb = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const normalize = (name) => String(name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const emailBase = (name) => normalize(String(name ?? '').trim().split(/\s+/).slice(0, 2).join(''));
const digits = (value) => String(value ?? '').replace(/\D/g, '');
const sellersResult = await adminDb.from('VENDEDORES').select('id, vendedor, telefone, quantos_lead, atender, ativo').order('id');
if (sellersResult.error) throw new Error(sellersResult.error.message);

const accessList = [
  ...sellersResult.data.map((seller) => ({
    email: `${emailBase(seller.vendedor)}@jotapveiculos.com`,
    password: digits(seller.telefone),
    expectedRole: 'vendedor',
    sellerName: seller.vendedor,
  })),
];

const results = [];
for (const access of accessList) {
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email: access.email, password: access.password });
  if (signed.error) {
    results.push({ email: access.email, authenticated: false, error: signed.error.message });
    continue;
  }
  const profile = await client.from('profiles').select('nome, cargo, desativado').eq('id', signed.data.user.id).single();
  const visible = await client.from('BASE_DE_LEADS').select('*', { count: 'exact', head: true });
  let expected = null;
  if (access.sellerName) {
    const expectedResult = await adminDb.from('BASE_DE_LEADS').select('*', { count: 'exact', head: true }).eq('vendedor', access.sellerName);
    if (expectedResult.error) throw new Error(expectedResult.error.message);
    expected = expectedResult.count;
  } else {
    const expectedResult = await adminDb.from('BASE_DE_LEADS').select('*', { count: 'exact', head: true });
    if (expectedResult.error) throw new Error(expectedResult.error.message);
    expected = expectedResult.count;
  }
  results.push({
    email: access.email,
    authenticated: true,
    role: profile.data?.cargo ?? null,
    profile_active: profile.data?.desativado === false,
    visible_leads: visible.count,
    expected_leads: expected,
    rls_matches: !visible.error && visible.count === expected,
    query_error: visible.error?.message,
  });
  await client.auth.signOut();
}

console.log(JSON.stringify({
  operational_sellers: sellersResult.data.length,
  active_operational_sellers: sellersResult.data.filter((seller) => seller.ativo !== false).length,
  duplicate_operational_names: sellersResult.data.length - new Set(sellersResult.data.map((seller) => normalize(seller.vendedor))).size,
  results,
}, null, 2));

if (results.some((result) => !result.authenticated || !result.rls_matches || !result.profile_active)) process.exitCode = 1;
