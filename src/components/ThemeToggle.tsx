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
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )}
      {dark ? 'Modo claro' : 'Modo escuro'}
    </button>
  );
}
