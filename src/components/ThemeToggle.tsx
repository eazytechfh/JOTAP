'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { getPreferredTheme, setTheme, type ThemePreference } from '@/lib/theme';

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<ThemePreference | null>(null);
  useEffect(() => setThemeState(getPreferredTheme()), []);

  if (theme === null) return <div className={clsx('h-9', className)} aria-hidden="true" />;
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        setTheme(next);
        setThemeState(next);
      }}
      className={clsx('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800', className)}
    >
      {dark ? '☀️ Modo claro' : '🌙 Modo escuro'}
    </button>
  );
}
