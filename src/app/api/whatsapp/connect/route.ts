import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = createClient();
  const { data: settings, error } = await supabase
    .from('app_settings')
    .select('uazapi_token, uazapi_base_url')
    .eq('id', 1)
    .single();

  if (error || !settings) {
    return NextResponse.json({ error: 'Configurações da uazapi não encontradas.' }, { status: 400 });
  }

  const { uazapi_token: token, uazapi_base_url: baseUrl } = settings as {
    uazapi_token: string | null;
    uazapi_base_url: string;
  };

  if (!token) {
    return NextResponse.json({ error: 'Token da uazapi não configurado.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${baseUrl}/instance/connect`, {
      method: 'POST',
      headers: { token, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error ?? data?.message ?? 'Falha ao conectar com a uazapi.' },
        { status: response.status }
      );
    }

    const qrcode = data?.qrcode ?? data?.qrCode ?? data?.instance?.qrcode ?? null;
    const instanceStatus = data?.instance?.status ?? data?.status ?? null;
    return NextResponse.json({ qrcode, status: instanceStatus, raw: data });
  } catch {
    return NextResponse.json({ error: 'Erro de rede ao conectar com a uazapi.' }, { status: 502 });
  }
}
