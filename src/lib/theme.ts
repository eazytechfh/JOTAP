const STORAGE_KEY = 'jotap-theme';

export type ThemePreference = 'light' | 'dark';

export function getStoredTheme(): ThemePreference | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

export function getPreferredTheme(): ThemePreference {
  return getStoredTheme() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme(theme: ThemePreference): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setTheme(theme: ThemePreference): void {
  window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export const NO_FLASH_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
