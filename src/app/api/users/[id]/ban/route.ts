import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canManageUsers } from '@/lib/auth/roles';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', userData.user.id)
    .single();

  const cargo = (profile as { cargo: string } | null)?.cargo;
  if (!canManageUsers(cargo)) {
    return NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 });
  }

  if (params.id === userData.user.id) {
    return NextResponse.json({ error: 'Você não pode desativar a própria conta.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const desativar = body.desativar !== false;

  const admin = createAdminClient();
  const { data: targetProfile, error: targetError } = await admin
    .from('profiles')
    .select('cargo')
    .eq('id', params.id)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  if ((targetProfile as { cargo: string }).cargo === 'admin_master') {
    return NextResponse.json({ error: 'A conta admin master não pode ser desativada.' }, { status: 403 });
  }

  // ban_duration grande (~100 anos) é usado como "desativação" permanente, já que o Supabase
  // Auth não possui um campo nativo de "ativo/inativo" — apenas suspensão temporária por duração.
  // "none" remove o ban e reativa o login normalmente.
  const { error: authError } = await admin.auth.admin.updateUserById(params.id, {
    ban_duration: desativar ? '876000h' : 'none',
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { error: statusError } = await admin.rpc('set_user_disabled', {
    p_user_id: params.id,
    p_disabled: desativar,
  });

  if (statusError) {
    await admin.auth.admin.updateUserById(params.id, {
      ban_duration: desativar ? 'none' : '876000h',
    });
    return NextResponse.json({ error: statusError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, desativado: desativar });
}
