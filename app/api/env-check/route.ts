import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 20) ?? null,
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
}