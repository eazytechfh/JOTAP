import { createBrowserClient } from '@supabase/ssr';

// Fallback de string vazia é usado APENAS para evitar que o build/import quebre quando as
// variáveis de ambiente reais ainda não foram configuradas (ex: build em CI sem .env).
// Isso NÃO silencia erros de runtime: se as credenciais estiverem vazias em produção, as
// chamadas ao Supabase falharão normalmente (erro de rede/autenticação), como esperado.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  );
}
