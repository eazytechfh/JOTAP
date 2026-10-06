import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Client com a service role key — possui privilégios administrativos completos (bypassa RLS).
// NUNCA importe este arquivo em código client-side ("use client") ou exponha a service role key
// ao navegador. Use apenas dentro de API Routes / Server Actions que rodam no servidor.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
