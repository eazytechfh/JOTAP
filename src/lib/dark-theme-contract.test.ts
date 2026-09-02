import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dark theme visual contract', () => {
  it('preserva as cores da marca sem clarear o vermelho no modo escuro', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    expect(css).toContain('--color-primaria-ativa: var(--color-primaria);');
    expect(css).not.toMatch(/\.dark[\s\S]*?--color-primaria-ativa:\s*color-mix/);
  });

  it('mantém o alternador de tema sempre visível na barra lateral', () => {
    const sidebar = readFileSync(resolve(process.cwd(), 'src/components/Sidebar.tsx'), 'utf8');
    const menuStart = sidebar.indexOf('{menuAberto &&');
    const toggle = sidebar.indexOf('<ThemeToggle');
    expect(toggle).toBeGreaterThan(0);
    expect(toggle).toBeLessThan(menuStart);
  });

  it('escurece o cartão de vendedor da vez', () => {
    const settings = readFileSync(resolve(process.cwd(), 'src/app/(app)/configuracoes/page.tsx'), 'utf8');
    expect(settings).toMatch(/bg-green-50[^"']*dark:border-green-900[^"']*dark:bg-green-950/);
  });
});
