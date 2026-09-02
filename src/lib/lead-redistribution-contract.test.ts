import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/0024_redistribuir_leads.sql');

describe('redistribuir_leads migration', () => {
  it('é transacional, autorizada e limitada à empresa e vendedores ativos', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('security definer');
    expect(sql).toContain('auth.uid()');
    expect(sql).toMatch(/admin_master[\s\S]*admin[\s\S]*gerente/);
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('desativado = false');
    expect(sql).toContain('ativo = true');
    expect(sql).toContain('id_empresa');
    expect(sql).toContain('row_number()');
    expect(sql).toContain('mod(');
    expect(sql).toContain('grant execute');
  });
});
