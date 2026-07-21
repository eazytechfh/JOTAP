import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Variáveis obrigatórias ausentes.');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const candidates = [
  'BASE_DE_LEADS', 'base_de_leads', 'VENDEDORES', 'vendedores', 'ESTOQUE', 'estoque',
  'profiles', 'pipeline_etapas', 'app_settings', 'etiquetas', 'lead_etiquetas',
  'lead_historico_estagio', 'AGENDAMENTOS', 'HISTORICO_VISITAS', 'HISTORICO_CHAT',
];

const report = { tables: {}, auth: {}, storage: {}, branding: {} };
for (const table of candidates) {
  const result = await db.from(table).select('*', { count: 'exact' }).limit(1);
  if (result.error) {
    report.tables[table] = { exists: false, code: result.error.code, message: result.error.message };
    continue;
  }
  report.tables[table] = {
    exists: true,
    count: result.count,
    columns: result.data?.[0] ? Object.keys(result.data[0]) : [],
  };
}

const leadSelect = 'id, id_empresa, nome_lead, telefone, email, origem, vendedor, veiculo_interesse, resumo_qualificacao, estagio_lead, resumo_comercial, created_at, updated_at, valor, observacao_vendedor, bot_ativo, "Etapa", "QuemEnviouMsg", "UltimaMensagem", StatusDeFollow:"Status de Follow", "Transferencia", PesquisaDeSatisfacao:"Pesquisa de satisfação"';
const allLeads = [];
for (let from = 0; ; from += 1000) {
  const page = await db.from('BASE_DE_LEADS').select(leadSelect).order('created_at', { ascending: false }).range(from, from + 999);
  if (page.error) {
    report.tables.BASE_DE_LEADS.ui_query_error = page.error.message;
    break;
  }
  allLeads.push(...page.data);
  if (page.data.length < 1000) break;
}
const seenLeads = new Set();
let duplicateCount = 0;
for (const lead of allLeads) {
  let phone = String(lead.telefone ?? '').replace(/\D/g, '');
  if (phone.length > 11 && phone.startsWith('55')) phone = phone.slice(2);
  const email = String(lead.email ?? '').trim().toLocaleLowerCase('pt-BR');
  const keyValue = phone ? `phone:${phone}` : email ? `email:${email}` : `id:${lead.id}`;
  if (seenLeads.has(keyValue)) duplicateCount += 1;
  else seenLeads.add(keyValue);
}
report.tables.BASE_DE_LEADS.ui_query_count = allLeads.length;
report.tables.BASE_DE_LEADS.ui_duplicate_count = duplicateCount;
report.tables.BASE_DE_LEADS.ui_display_count = allLeads.length - duplicateCount;

const stockQuery = await db.from('estoque').select('id, marca, modelo, ano, cor, combustivel, quilometragem, status, created_at, updated_at, placa, "link imagem 0", valor, "link imagem 1", "link imagem 2", "link imagem 3", "ID VEICULO", tipo').order('created_at', { ascending: false });
report.tables.estoque.ui_query = stockQuery.error ? { error: stockQuery.error.message } : { count: stockQuery.data.length };

for (const column of ['estagio_lead', 'Etapa']) {
  const result = await db.from('BASE_DE_LEADS').select(column).limit(10000);
  if (!result.error) {
    report.tables.BASE_DE_LEADS[`${column}_values`] = [...new Set(result.data.map((row) => row[column]).filter(Boolean))].sort();
  }
}

const users = [];
for (let page = 1; ; page += 1) {
  const result = await db.auth.admin.listUsers({ page, perPage: 1000 });
  if (result.error) {
    report.auth.error = result.error.message;
    break;
  }
  users.push(...result.data.users);
  if (result.data.users.length < 1000) break;
}
report.auth.count = users.length;
report.auth.banned = users.filter((user) => user.banned_until && new Date(user.banned_until) > new Date()).length;
report.auth.confirmed = users.filter((user) => user.email_confirmed_at).length;

const profiles = await db.from('profiles').select('id, nome, email, cargo, desativado');
const sellers = await db.from('VENDEDORES').select('*');
if (!profiles.error && !sellers.error) {
  const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('pt-BR');
  const authIds = new Set(users.map((user) => user.id));
  const authEmails = new Set(users.map((user) => normalize(user.email)));
  const profileIds = new Set(profiles.data.map((profile) => profile.id));
  const profileEmails = new Set(profiles.data.map((profile) => normalize(profile.email)));
  const sellerNames = new Set(sellers.data.map((seller) => normalize(seller.vendedor ?? seller.VENDEDOR)));
  report.auth.profiles = profiles.data.length;
  report.auth.profiles_without_auth = profiles.data.filter((profile) => !authIds.has(profile.id)).length;
  report.auth.auth_without_profile = users.filter((user) => !profileIds.has(user.id)).length;
  report.auth.auth_email_without_profile = users.filter((user) => !profileEmails.has(normalize(user.email))).length;
  report.auth.sellers = sellers.data.length;
  report.auth.seller_profiles_without_operational_row = profiles.data.filter((profile) => profile.cargo === 'vendedor' && !sellerNames.has(normalize(profile.nome))).length;
  report.auth.duplicate_seller_names = sellers.data.length - sellerNames.size;
  report.auth.auth_emails_known = authEmails.size;
}

const buckets = await db.storage.listBuckets();
report.storage = buckets.error
  ? { error: buckets.error.message }
  : { buckets: buckets.data.map(({ id, name, public: isPublic }) => ({ id, name, public: isPublic })) };

const branding = await db.rpc('get_branding').single();
report.branding = branding.error
  ? { error: branding.error.message }
  : { available: true, logo_configured: Boolean(branding.data?.logo_url), colors: {
      cor_primaria: branding.data?.cor_primaria,
      cor_secundaria: branding.data?.cor_secundaria,
      cor_texto: branding.data?.cor_texto,
      cor_fundo: branding.data?.cor_fundo,
    } };

console.log(JSON.stringify(report, null, 2));
