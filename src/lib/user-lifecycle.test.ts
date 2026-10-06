import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string): string {
  const absolutePath = resolve(process.cwd(), path);
  return existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : '';
}

const migration = read('supabase/migrations/0023_user_lifecycle.sql');
const banRoute = read('src/app/api/users/[id]/ban/route.ts');
const deleteRoute = read('src/app/api/users/[id]/route.ts');
const settingsPage = read('src/app/(app)/configuracoes/page.tsx');
const newLeadModal = read('src/components/NovoLeadModal.tsx');
const leadDrawer = read('src/components/LeadDrawer.tsx');

describe('ciclo de vida de usuarios', () => {
  it('sincroniza desativacao do perfil e vendedor por nome normalizado', () => {
    expect(migration).toMatch(/add column if not exists user_id uuid/i);
    expect(migration).toMatch(/create unique index[\s\S]*?on public\."VENDEDORES" \(user_id\)/i);
    expect(migration).toMatch(
      /create or replace function public\.set_user_disabled\(p_user_id uuid, p_disabled boolean\)/i
    );
    expect(migration).toMatch(/select nome, cargo into v_nome, v_cargo/i);
    expect(migration).toMatch(/if v_cargo = 'admin_master' then[\s\S]*?raise exception/i);
    expect(migration).toMatch(/if v_cargo = 'vendedor' then/i);
    expect(migration).toMatch(/update public\.profiles[\s\S]*?desativado\s*=\s*p_disabled/i);
    expect(migration).toMatch(
      /update public\."VENDEDORES"[\s\S]*?ativo\s*=\s*not p_disabled[\s\S]*?atender\s*=\s*case[\s\S]*?when p_disabled then 'inativo'/i
    );
    expect(migration).toMatch(/where user_id = p_user_id/i);
    expect(migration).toMatch(
      /if not exists \(select 1 from public\."VENDEDORES" where user_id = p_user_id\) then[\s\S]*?select count\(\*\) into v_matching_profiles/i
    );
    expect(migration).toMatch(/v_matching_profiles > 1[\s\S]*?raise exception/i);
    expect(banRoute).toContain("admin.rpc('set_user_disabled'");
  });

  it('mantem inativos visiveis na fila, separados dos vendedores ativos', () => {
    expect(settingsPage).toContain(".select('id, created_at, vendedor, telefone, atender, quantos_lead, id_click, id_empresa, ativo')");
    expect(settingsPage).not.toMatch(
      /from\('VENDEDORES'\)[\s\S]*?\.eq\('ativo', true\)[\s\S]*?\.order\('id'/
    );
    expect(settingsPage).toContain('const ativos = vendedores.filter((v) => v.ativo)');
    expect(settingsPage).toContain('const desativados = vendedores.filter((v) => !v.ativo)');
    expect(settingsPage).toContain('Vendedores desativados');
    expect(newLeadModal).toMatch(/from\('VENDEDORES'\)[\s\S]*?\.eq\('ativo', true\)/);
    expect(leadDrawer).toMatch(/from\('VENDEDORES'\)[\s\S]*?\.eq\('ativo', true\)/);
  });

  it('remove dados operacionais no mesmo delete do usuario de authentication', () => {
    expect(migration).toMatch(/create or replace function public\.cleanup_deleted_auth_user\(\)/i);
    expect(migration).toMatch(/before delete on auth\.users/i);
    expect(migration).toMatch(/delete from public\."VENDEDORES"[\s\S]*?where user_id = old\.id/i);
    expect(migration).toMatch(/if v_cargo = 'admin_master' then[\s\S]*?raise exception/i);
    expect(migration).toMatch(/v_matching_sellers > 1[\s\S]*?raise exception/i);
    expect(migration).toMatch(/v_matching_profiles > 1[\s\S]*?raise exception/i);
    expect(migration).toContain("to_regclass('public.usuarios')");
    expect(migration).toMatch(/delete from public\.usuarios where lower\(trim\(email\)\)/i);
    expect(migration).toMatch(/delete from public\.profiles\s+where id = old\.id/i);
  });

  it('protege a rota de exclusao e usa a API administrativa do Auth', () => {
    expect(deleteRoute).toContain('canManageUsers');
    expect(deleteRoute).toContain('params.id === userData.user.id');
    expect(deleteRoute).toMatch(/targetProfile[\s\S]*?cargo === 'admin_master'/);
    expect(deleteRoute).toContain('admin.auth.admin.deleteUser(params.id)');
  });

  it('oferece excluir ao lado da acao de desativacao e remove a linha apos sucesso', () => {
    expect(settingsPage).toContain('async function excluirUsuario');
    expect(settingsPage).toContain("method: 'DELETE'");
    expect(settingsPage).toMatch(/setProfiles\(\(prev\)\s*=>\s*prev\.filter\(\(p\)\s*=>\s*p\.id !== id\)\)/);
    expect(settingsPage).toContain("'Excluir usuário'");
    expect(settingsPage).toMatch(/Excluir[\s\S]*?<\/button>/);
    expect(settingsPage).toMatch(/async function excluirUsuario[\s\S]*?try \{[\s\S]*?catch[\s\S]*?finally/);
  });
});
