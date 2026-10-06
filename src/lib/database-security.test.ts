import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationIaPath = resolve(process.cwd(), 'supabase/migrations/0013_lead_ia_controle.sql');
const migrationCargo = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0012_jotap_rls_hardening.sql'),
  'utf8'
);

describe('segurança no banco', () => {
  it('impede autoelevação no banco e limita updates de perfis a gestores', () => {
    const migrationIa = readFileSync(migrationIaPath, 'utf8');
    expect(migrationCargo).toContain('before update of cargo');
    expect(migrationCargo).toMatch(/get_my_cargo\(\) in \('admin_master','admin','gerente'\)/);
    expect(migrationCargo).not.toMatch(/using \(id = auth\.uid\(\) or/);
    expect(migrationIa).toContain("using (id_empresa = 1 and public.get_my_cargo() in");
    expect(migrationIa).toContain("using errcode = '42501'");
  });

  it('preserva bot_ativo como varchar, normaliza strings e impõe default false e not null', () => {
    const sql = readFileSync(migrationIaPath, 'utf8');
    expect(sql).toContain('information_schema.columns');
    expect(sql).not.toMatch(/alter column bot_ativo type boolean/i);
    expect(sql).toMatch(/alter column bot_ativo type varchar/i);
    expect(sql).toMatch(/valor legado incompatível/i);
    expect(sql).toMatch(/set bot_ativo = case/i);
    expect(sql).toMatch(/then 'true'\s+else 'false'/i);
    expect(sql).toMatch(/alter column bot_ativo set default 'false'/i);
    expect(sql).toMatch(/alter column bot_ativo set not null/i);
  });

  it('usa o relógio do banco e impede alteração isolada do timestamp', () => {
    const sql = readFileSync(migrationIaPath, 'utf8');
    expect(sql).toContain('IS DISTINCT FROM');
    expect(sql).toContain('now()');
    expect(sql).toContain('old.bot_ativo_alterado_em');
    expect(sql).toMatch(/before update of bot_ativo, bot_ativo_alterado_em/i);
  });
});
