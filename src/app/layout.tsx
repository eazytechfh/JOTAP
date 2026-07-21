import type { Metadata } from 'next';
import './globals.css';
import { fetchBranding } from '@/lib/branding';

export const metadata: Metadata = {
  title: 'JOTAP Veículos CRM',
  description: 'CRM da JOTAP Veículos',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await fetchBranding();

  return (
    <html lang="pt-BR">
      <head>
        <style>{`:root {
          --color-fundo: ${branding.cor_fundo};
          --color-texto: ${branding.cor_texto};
          --color-primaria: ${branding.cor_primaria};
          --color-secundaria: ${branding.cor_secundaria};
        }`}</style>
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
