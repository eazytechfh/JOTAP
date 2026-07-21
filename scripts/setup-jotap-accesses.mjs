import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Variáveis obrigatórias ausentes.');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const apply = process.argv.includes('--apply');
const adminEmail = process.env.JOTAP_ADMIN_EMAIL ?? 'admin@jotapveiculos.com';
const adminPassword = process.env.JOTAP_ADMIN_PASSWORD;
const normalizeEmailLocal = (name) => String(name ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const emailBase = (name) => normalizeEmailLocal(String(name ?? '').trim().split(/\s+/).slice(0, 2).join(''));
const digits = (value) => String(value ?? '').replace(/\D/g, '');

const sellersResult = await db.from('VENDEDORES').select('id, vendedor, telefone, quantos_lead, atender, ativo').order('id');
if (sellersResult.error) throw new Error(`Falha ao ler VENDEDORES: ${sellersResult.error.message}`);

const sellers = sellersResult.data.map((seller) => ({
  ...seller,
  email: `${emailBase(seller.vendedor)}@jotapveiculos.com`,
  password: digits(seller.telefone),
}));

const invalid = sellers.filter((seller) => !seller.vendedor || !emailBase(seller.vendedor) || seller.password.length < 6);
const emails = sellers.map((seller) => seller.email);
const collisions = emails.filter((email, index) => emails.indexOf(email) !== index);

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'preview',
  admin_email: adminEmail,
  admin_password_configured: Boolean(adminPassword),
  sellers: sellers.map((seller) => ({ email: seller.email, phone_digits: seller.password.length, has_valid_password: seller.password.length >= 6 })),
  invalid_count: invalid.length,
  collision_count: new Set(collisions).size,
}, null, 2));

if (apply) {
if (!adminPassword) throw new Error('JOTAP_ADMIN_PASSWORD é obrigatória no modo --apply.');
if (invalid.length || collisions.length) throw new Error('Pré-validação falhou; nenhuma conta foi criada.');

const existingUsers = [];
for (let page = 1; ; page += 1) {
  const result = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (result.error) throw new Error(`Falha ao listar Auth: ${result.error.message}`);
  existingUsers.push(...result.data.users);
  if (result.data.users.length < 1000) break;
}
const existingByEmail = new Map(existingUsers.map((user) => [user.email?.trim().toLowerCase(), user]));
const results = [];

async function createAccess({ email, password, nome, cargo, telefone }) {
  const existing = existingByEmail.get(email);
  if (existing) {
    const repaired = await db.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { nome, cargo, telefone },
      app_metadata: { ...(existing.app_metadata ?? {}), cargo },
    });
    if (repaired.error) {
      results.push({ email, status: 'error', error: repaired.error.message });
      return;
    }
    const profile = await db.from('profiles').upsert({ id: existing.id, nome, email, cargo, desativado: false });
    if (profile.error) {
      results.push({ email, status: 'error', error: profile.error.message });
      return;
    }
    if (cargo === 'vendedor') {
      const seller = await db.from('VENDEDORES').update({ telefone, ativo: true }).eq('vendedor', nome);
      if (seller.error) {
        results.push({ email, status: 'error', error: seller.error.message });
        return;
      }
    }
    results.push({ email, status: 'repaired', id: existing.id });
    return;
  }
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, cargo, telefone },
    app_metadata: { cargo },
  });
  if (created.error) {
    results.push({ email, status: 'error', error: created.error.message });
    return;
  }
  existingByEmail.set(email, created.data.user);
  results.push({ email, status: 'created', id: created.data.user.id });
}

await createAccess({
  email: adminEmail,
  password: adminPassword,
  nome: 'Administrador JOTAP',
  cargo: 'admin',
});
for (const seller of sellers) {
  await createAccess({
    email: seller.email,
    password: seller.password,
    nome: seller.vendedor,
    cargo: 'vendedor',
    telefone: seller.telefone,
  });
}

const createdIds = results.filter((result) => result.id).map((result) => result.id);
const profiles = createdIds.length
  ? await db.from('profiles').select('id, email, cargo').in('id', createdIds)
  : { data: [], error: null };
if (profiles.error) throw new Error(`Contas criadas, mas a verificação de profiles falhou: ${profiles.error.message}`);

console.log(JSON.stringify({
  results: results.map(({ email, status, error }) => ({ email, status, ...(error ? { error } : {}) })),
  created: results.filter((result) => result.status === 'created').length,
  errors: results.filter((result) => result.status === 'error').length,
  verified_profiles: profiles.data.length,
}, null, 2));

if (results.some((result) => result.status === 'error') || profiles.data.length !== createdIds.length) process.exitCode = 1;
}
