import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const supabaseUrl = "https://kqxldrdegfgwlzwszbel.supabase.co"
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxeGxkcmRlZ2Znd2x6d3N6YmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NzE2MzEsImV4cCI6MjA3NTM0NzYzMX0.Td2mDNBrMsieicHJXXFz4b0w9t2VsiyJ9tthexs-MIc"

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
