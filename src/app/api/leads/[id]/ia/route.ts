import { NextResponse } from 'next/server';
import { canManageUsers } from '@/lib/auth/roles';
import {
  confirmarTransicaoBot,
  isLeadIdValido,
} from '@/lib/lead-management';
import { createClient } from '@/lib/supabase/server';

const EMPRESA_ID = 1;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const leadId = Number(params.id);
  if (!isLeadIdValido(leadId)) {
    return NextResponse.json({ error: 'Lead inválido.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }
  const ativo = (body as { ativo?: unknown } | null)?.ativo;
  if (typeof ativo !== 'boolean') {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!canManageUsers((profile as { cargo?: string } | null)?.cargo)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('BASE_DE_LEADS')
    .update({ bot_ativo: ativo ? 'true' : 'false' })
    .eq('id', leadId)
    .eq('id_empresa', EMPRESA_ID)
    .eq('bot_ativo', ativo ? 'false' : 'true')
    .select('id, bot_ativo, bot_ativo_alterado_em')
    .maybeSingle();

  if (error || !confirmarTransicaoBot(leadId, ativo, data)) {
    return NextResponse.json({ error: 'Lead não encontrado ou estado desatualizado.' }, { status: 404 });
  }

  return NextResponse.json({ ...data, bot_ativo: ativo });
}
