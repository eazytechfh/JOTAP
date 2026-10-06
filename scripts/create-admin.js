#!/usr/bin/env node
/**
 * Cria o primeiro usuário admin_master de um novo cliente, direto no Supabase Auth.
 *
 * admin_master é uma role oculta (senha padrão dos desenvolvedores) que não pode ser criada
 * pela UI do CRM — por isso esse passo só existe como script de linha de comando, rodado pela
 * equipe uma vez por cliente, depois que o deploy na Vercel já está de pé (precisa do
 * SUPABASE_SERVICE_ROLE_KEY do .env.local apontando para o projeto do cliente).
 *
 * Uso (PowerShell ou qualquer terminal, na pasta do projeto já com .env.local configurado):
 *   npm run setup:admin -- "admin@cliente.com" "SenhaProvisoria123" "Nome do Admin"
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const [email, password, nome] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Uso: npm run setup:admin -- "<email>" "<senha>" "<nome (opcional)>"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar no .env.local.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: nome || 'Admin Master', cargo: 'admin_master' },
    app_metadata: { cargo: 'admin_master' },
  });

  if (error) {
    console.error('Erro ao criar usuário:', error.message);
    process.exit(1);
  }

  console.log(`Usuário admin_master criado: ${data.user.id} (${data.user.email})`);
}

main();
