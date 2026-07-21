import { readFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Variáveis obrigatórias ausentes.');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const bytes = await readFile('public/jotap.png');
const uploaded = await db.storage.from('logos').upload('jotap.png', bytes, { contentType: 'image/png', upsert: true });
if (uploaded.error) throw new Error(`Upload falhou: ${uploaded.error.message}`);
const publicUrl = db.storage.from('logos').getPublicUrl('jotap.png').data.publicUrl;
const response = await fetch(publicUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Logo pública retornou HTTP ${response.status}.`);
const updated = await db.from('app_settings').update({ logo_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', 1);
if (updated.error) throw new Error(`Branding não atualizado: ${updated.error.message}`);
console.log(JSON.stringify({ uploaded: true, http_status: response.status, logo_url: publicUrl }, null, 2));
