import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getStoredTheme, NO_FLASH_THEME_SCRIPT, setTheme } from './theme';

describe('theme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lê apenas preferências válidas', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => 'dark' } });
    expect(getStoredTheme()).toBe('dark');
  });

  it('aplica a classe dark no documento', () => {
    const toggle = vi.fn();
    vi.stubGlobal('document', { documentElement: { classList: { toggle } } });
    applyTheme('dark');
    expect(toggle).toHaveBeenCalledWith('dark', true);
  });

  it('persiste e aplica a preferência', () => {
    const setItem = vi.fn();
    const toggle = vi.fn();
    vi.stubGlobal('window', { localStorage: { setItem } });
    vi.stubGlobal('document', { documentElement: { classList: { toggle } } });
    setTheme('light');
    expect(setItem).toHaveBeenCalledWith('jotap-theme', 'light');
    expect(toggle).toHaveBeenCalledWith('dark', false);
  });

  it('fornece script para aplicar o tema antes da primeira pintura', () => {
    expect(NO_FLASH_THEME_SCRIPT).toContain("localStorage.getItem('jotap-theme')");
    expect(NO_FLASH_THEME_SCRIPT).toContain("classList.add('dark')");
  });
});
