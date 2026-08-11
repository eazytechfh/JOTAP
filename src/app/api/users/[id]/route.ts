import { NextResponse } from 'next/server';
import { canManageUsers } from '@/lib/auth/roles';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: requesterProfile } = await supabase
    .from('profiles')
    .select('cargo')
    .eq('id', userData.user.id)
    .single();

  if (!canManageUsers((requesterProfile as { cargo: string } | null)?.cargo)) {
    return NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 });
  }

  if (params.id === userData.user.id) {
    return NextResponse.json({ error: 'Você não pode excluir a própria conta.' }, { status: 400 });
  }

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
    return NextResponse.json({ error: 'A conta admin master não pode ser excluída.' }, { status: 403 });
  }

  // O trigger cleanup_deleted_auth_user remove VENDEDORES e usuarios na mesma
  // transacao, incluindo profiles.
  const { error: deleteError } = await admin.auth.admin.deleteUser(params.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
