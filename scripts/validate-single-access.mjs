import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });
const [email, password, expectedRole] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon || !email || !password || !expectedRole) {
  throw new Error('Uso: node scripts/validate-single-access.mjs <email> <senha> <cargo>');
}

const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const signed = await client.auth.signInWithPassword({ email, password });
if (signed.error) throw new Error(`Autenticação falhou: ${signed.error.message}`);
const profile = await client.from('profiles').select('cargo, desativado').eq('id', signed.data.user.id).single();
if (profile.error) throw new Error(`Profile falhou: ${profile.error.message}`);
const leads = await client.from('BASE_DE_LEADS').select('*', { count: 'exact', head: true });
if (leads.error) throw new Error(`Consulta RLS falhou: ${leads.error.message}`);
console.log(JSON.stringify({
  email,
  authenticated: true,
  role: profile.data.cargo,
  role_matches: profile.data.cargo === expectedRole,
  profile_active: profile.data.desativado === false,
  visible_leads: leads.count,
}, null, 2));
await client.auth.signOut();
if (profile.data.cargo !== expectedRole || profile.data.desativado !== false) process.exitCode = 1;
