import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('pipeline configurável', () => {
  it('normaliza nomes em identificadores estáveis', async () => {
    const modulePath = join(root, 'src', 'lib', 'pipeline-etapas.ts');
    expect(existsSync(modulePath), 'o módulo pipeline-etapas.ts ainda não existe').toBe(true);

    const { normalizarSlug } = await import('./pipeline-etapas');
    expect(normalizarSlug('  Pós Venda Especial  ')).toBe('pos_venda_especial');
    expect(normalizarSlug('***')).toBe('');
  });

  it('integra etapas dinâmicas nas telas que exibem ou alteram estágio', () => {
    const expectedFiles = [
      ['src', 'app', '(app)', 'pipeline', 'page.tsx'],
      ['src', 'app', '(app)', 'leads', 'page.tsx'],
      ['src', 'app', '(app)', 'dashboard', 'page.tsx'],
      ['src', 'components', 'NovoLeadModal.tsx'],
    ];

    for (const parts of expectedFiles) {
      const source = readFileSync(join(root, ...parts), 'utf8');
      expect(source, parts.join('/')).toMatch(/usePipelineEtapas/);
    }
  });

  it('expõe a edição apenas para admin, admin_master e gerente', () => {
    const source = readFileSync(
      join(root, 'src', 'app', '(app)', 'configuracoes', 'page.tsx'),
      'utf8'
    );

    expect(source).toMatch(/id: 'etapas'/);
    expect(source).toMatch(/PipelineEtapasTab/);
    expect(source).toMatch(/admin_master/);
    expect(source).toMatch(/admin/);
    expect(source).toMatch(/gerente/);
  });

  it('protege escrita, exclusão em uso e reordenação no banco', () => {
    const migrationPath = join(
      root,
      'supabase',
      'migrations',
      '0017_pipeline_etapas_configuraveis.sql'
    );
    expect(existsSync(migrationPath), 'a migration 0017 ainda não existe').toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/get_my_cargo\(\)[\s\S]*admin_master[\s\S]*admin[\s\S]*gerente/);
    expect(sql).toMatch(/impedir_exclusao_etapa_em_uso/);
    expect(sql).toMatch(/reordenar_pipeline_etapas/);
    expect(sql).toMatch(/BASE_DE_LEADS/);
  });

  it('exclui etapa editável de forma atômica e realoca seus leads', () => {
    const config = readFileSync(
      join(root, 'src', 'app', '(app)', 'configuracoes', 'page.tsx'),
      'utf8'
    );
    expect(config).toContain("rpc('excluir_pipeline_etapa'");

    const migrationPath = join(
      root,
      'supabase',
      'migrations',
      '0018_excluir_pipeline_etapa.sql'
    );
    expect(existsSync(migrationPath), 'a migration 0018 ainda não existe').toBe(true);

    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/function public\.excluir_pipeline_etapa/);
    expect(sql).toMatch(/update public\."BASE_DE_LEADS"[\s\S]*estagio_lead = p_destino/);
    expect(sql).toMatch(/delete from public\.pipeline_etapas/);
    expect(sql).toMatch(/pipeline_etapa_protegida/);
  });
});
