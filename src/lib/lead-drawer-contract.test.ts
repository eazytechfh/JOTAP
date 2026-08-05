import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const drawer = readFileSync(resolve(process.cwd(), 'src/components/LeadDrawer.tsx'), 'utf8');

describe('contrato do drawer de lead', () => {
  it('exige confirmação acessível antes da exclusão', () => {
    expect(drawer).toContain('Excluir lead');
    expect(drawer).toContain('Confirmar exclusão');
    expect(drawer).toContain('role="dialog"');
    expect(drawer).toContain('aria-modal="true"');
    expect(drawer).toContain('aria-labelledby="confirmar-exclusao-titulo"');
    expect(drawer).toContain('Excluindo...');
  });

  it('mostra o estado persistido e acessível da IA', () => {
    expect(drawer).toContain('IA ativa');
    expect(drawer).toContain('IA inativa');
    expect(drawer).toContain('Última alteração:');
    expect(drawer).toContain('aria-pressed={botAtivo}');
    expect(drawer).toContain('Alterando IA...');
  });

  it('confirma a observação somente depois da resposta do banco', () => {
    expect(drawer).toContain('Observação salva com sucesso');
    expect(drawer).toContain("select('id, observacao_vendedor')");
  });

  it('serializa mutações para impedir respostas concorrentes com snapshots antigos', () => {
    expect(drawer).toContain('mutacaoEmAndamentoRef.current');
    expect(drawer).toContain('.tentarAdquirir()');
    expect(drawer).toContain('.liberar()');
  });

  it.each([
    'src/app/(app)/leads/page.tsx',
    'src/app/(app)/pipeline/page.tsx',
  ])('%s remove o lead localmente pelo callback', (path) => {
    const consumer = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(consumer).toContain('onDeleted={(leadId)');
    expect(consumer).toContain('filter((l) => l.id !== leadId)');
  });
});
