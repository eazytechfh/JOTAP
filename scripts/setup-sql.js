#!/usr/bin/env node
/**
 * Aplica todas as migrations SQL de supabase/migrations/ em ordem, num projeto Supabase novo.
 *
 * Uso (PowerShell ou qualquer terminal):
 *   npm run setup:sql -- "postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres"
 *
 * Use a connection string de "Connection Pooling" (Settings > Database > Connection Pooling,
 * modo "Session"), não a conexão direta — a conexão direta só resolve em IPv6 hoje e costuma
 * dar timeout em redes sem saída IPv6.
 *
 * Todas as migrations usam "if not exists" / "drop policy if exists" etc., então rodar este
 * script mais de uma vez no mesmo banco não causa erro nem duplica nada.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.argv[2];

  if (!connectionString) {
    console.error('Uso: npm run setup:sql -- "<connection-string-do-postgres>"');
    console.error('Encontre a connection string em: Supabase > Settings > Database > Connection string (URI)');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const arquivos = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (arquivos.length === 0) {
    console.error('Nenhum arquivo .sql encontrado em supabase/migrations.');
    process.exit(1);
  }

  const host = new URL(connectionString).hostname;
  console.log(`Conectando em: ${host}`);
  console.log(`${arquivos.length} migration(s) a aplicar:\n  - ${arquivos.join('\n  - ')}\n`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (err) {
    if (err.code === 'ETIMEDOUT' || err.code === 'ENETUNREACH') {
      console.error(
        '\nNão foi possível conectar (timeout). A conexão direta do Supabase ' +
          '("db.xxxx.supabase.co:5432") hoje só resolve em IPv6, e muita rede não tem saída ' +
          'IPv6 funcional.\n\nSolução: use a string de "Connection Pooling" em vez da conexão ' +
          'direta. No painel do Supabase: Settings > Database > Connection Pooling, modo ' +
          '"Session", copie a URI de lá (formato: postgresql://postgres.xxxx:SENHA@aws-0-' +
          'REGIAO.pooler.supabase.com:5432/postgres) e rode o comando novamente com essa string.'
      );
      process.exit(1);
    }
    throw err;
  }

  try {
    for (const arquivo of arquivos) {
      const caminho = path.join(migrationsDir, arquivo);
      const sql = fs.readFileSync(caminho, 'utf-8');

      process.stdout.write(`Aplicando ${arquivo}... `);
      try {
        await client.query(sql);
        console.log('OK');
      } catch (err) {
        console.log('FALHOU');
        throw new Error(`Erro em ${arquivo}: ${err.message}`);
      }
    }
    console.log('\nTodas as migrations foram aplicadas com sucesso.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nSetup interrompido:', err.message);
  process.exit(1);
});
