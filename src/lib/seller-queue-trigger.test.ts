import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/0022_restore_new_seller_queue.sql'
);
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

describe('trigger de novo vendedor e fila de atendimento', () => {
  it('mantem o cargo protegido em app_metadata e valida os cargos permitidos', () => {
    expect(sql).toContain("new.raw_app_meta_data->>'cargo'");
    expect(sql).toContain("v_cargo not in ('admin_master', 'admin', 'gerente', 'vendedor')");
  });

  it('reutiliza a linha operacional sem alterar vez ou contagem', () => {
    const sellerBranch = sql.match(
      /if v_cargo = 'vendedor'.*?if not found/is
    )?.[0] ?? '';
    const existingSellerUpdate = sellerBranch.split(/if not found/i)[0] ?? '';

    expect(existingSellerUpdate).toContain('update public."VENDEDORES"');
    expect(existingSellerUpdate).toMatch(
      /lower\(trim\(vendedor\)\)\s*=\s*lower\(trim\(v_nome\)\)/i
    );
    expect(existingSellerUpdate).toMatch(
      /telefone\s*=\s*case\s+when nullif\(trim\(telefone\),\s*''\) is null\s+then v_telefone\s+else telefone\s+end/i
    );
    expect(existingSellerUpdate).toMatch(/ativo\s*=\s*true/i);
    expect(existingSellerUpdate).toContain(
      'pg_advisory_xact_lock(hashtextextended(lower(trim(v_nome)), 0))'
    );
    expect(existingSellerUpdate).not.toMatch(/atender\s*=/i);
    expect(existingSellerUpdate).not.toMatch(/quantos_lead\s*=/i);
    expect(existingSellerUpdate).not.toMatch(/id_empresa\s*=/i);
  });

  it('insere somente vendedor ausente no fim logico da fila', () => {
    expect(sql).toMatch(
      /insert into public\."VENDEDORES"\s*\(vendedor, telefone, id_empresa, atender, quantos_lead, ativo\)[\s\S]*?values\s*\(v_nome,\s*v_telefone,\s*1,\s*'espera',\s*0,\s*true\)/i
    );
  });

  it('reconcilia perfis vendedores ativos que ainda nao possuem linha operacional', () => {
    const backfillBlock = sql.match(/do \$\$[\s\S]*?\$\$;/i)?.[0] ?? '';

    expect(backfillBlock).toMatch(
      /from public\.profiles p[\s\S]*?p\.cargo = 'vendedor'[\s\S]*?p\.desativado = false[\s\S]*?not exists[\s\S]*?from public\."VENDEDORES" v/is
    );
    expect(backfillBlock).toMatch(
      /lower\(trim\(v\.vendedor\)\)\s*=\s*v_profile\.nome_normalizado/i
    );
    expect(backfillBlock).toMatch(/distinct on \(lower\(trim\(p\.nome\)\)\)/i);
    expect(backfillBlock).toMatch(
      /pg_advisory_xact_lock\(hashtextextended\(v_profile\.nome_normalizado, 0\)\)/i
    );
    expect(backfillBlock).toMatch(
      /insert into public\."VENDEDORES"\s*\(vendedor, telefone, id_empresa, atender, quantos_lead, ativo\)[\s\S]*?select v_profile\.nome,\s*null,\s*1,\s*'espera',\s*0,\s*true/i
    );
  });
});
