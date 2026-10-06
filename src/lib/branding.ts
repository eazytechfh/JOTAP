import { createClient } from '@/lib/supabase/server';

export interface Branding {
  logo_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  cor_texto: string;
  cor_fundo: string;
}

const DEFAULT_BRANDING: Branding = {
  logo_url: '/jotap.png',
  cor_primaria: '#c81e2b',
  cor_secundaria: '#1769aa',
  cor_texto: '#111827',
  cor_fundo: '#f5f6f8',
};

// Valida que o valor é um hex color simples (#fff ou #ffffff) antes de interpolar no <style>
// inline do RootLayout — defesa contra CSS injection caso algo grave um valor inesperado na
// coluna (a escrita já é restrita a admin_master via RLS, isto é só uma segunda camada).
function sanitizeHex(value: string | null, fallback: string): string {
  if (value && /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(value)) return value;
  return fallback;
}

// get_branding() é uma função SECURITY DEFINER (ver migration 0007) que expõe só as colunas de
// marca de app_settings para anon/authenticated, sem abrir acesso ao token da uazapi guardado
// na mesma tabela.
export async function fetchBranding(): Promise<Branding> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_branding').single();

  if (error || !data) return DEFAULT_BRANDING;

  const raw = data as Branding;
  return {
    logo_url: raw.logo_url,
    cor_primaria: sanitizeHex(raw.cor_primaria, DEFAULT_BRANDING.cor_primaria),
    cor_secundaria: sanitizeHex(raw.cor_secundaria, DEFAULT_BRANDING.cor_secundaria),
    cor_texto: sanitizeHex(raw.cor_texto, DEFAULT_BRANDING.cor_texto),
    cor_fundo: sanitizeHex(raw.cor_fundo, DEFAULT_BRANDING.cor_fundo),
  };
}
