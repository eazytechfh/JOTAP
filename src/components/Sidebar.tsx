'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Avatar } from './Avatar';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from './ThemeToggle';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Visão Geral',
    hideFor: ['vendedor'] as string[],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M3 12h4l3 8 4-16 3 8h4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: '/leads',
    label: 'Leads',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
        <path
          d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/pipeline',
    label: 'Pipeline',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <rect x="3" y="4" width="4" height="16" rx="1" stroke="currentColor" strokeWidth="2" />
        <rect x="10" y="4" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
        <rect x="17" y="4" width="4" height="13" rx="1" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: '/estoque',
    label: 'Estoque',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M3 11l2-6h14l2 6M5 11h14v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="18" r="1" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="18" r="1" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    href: '/configuracoes',
    label: 'Configurações',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
        <path
          d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0019.4 9a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51 1z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

interface SidebarProps {
  userName: string;
  userCargo: string;
  logoUrl?: string | null;
}

export function Sidebar({ userName, userCargo, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibleItems = NAV_ITEMS.filter((item) => !item.hideFor?.includes(userCargo));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-card dark:border-gray-800">
      <div className="px-5 py-6">
        {logoUrl && (
          <div className="mb-3 inline-flex h-16 max-w-[200px] items-center justify-center overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo enviada pelo admin_master via upload, URL dinâmica de Storage */}
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
          </div>
        )}
        <h1 className="text-lg font-bold text-foreground">JOTAP Veículos</h1>
        <p className="text-xs text-gray-500">CRM</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visibleItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div ref={menuRef} className="relative border-t border-gray-200 px-4 py-4 dark:border-gray-800">
        <ThemeToggle className="mb-2" />
        {menuAberto && (
          <div className="absolute bottom-full left-4 right-4 mb-2 rounded-lg border border-gray-200 bg-card py-1 shadow-lg dark:border-gray-700">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Sair
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          className="flex w-full items-center gap-3 rounded-lg p-1 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Avatar name={userName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs capitalize text-gray-500">{userCargo.replace('_', ' ')}</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
