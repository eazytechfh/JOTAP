import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Abordagem escolhida: gerar um link de recuperação de senha (generateLink type "recovery") em
// vez de definir uma nova senha diretamente. Isso evita que o admin precise digitar/transmitir
// uma senha temporária em texto puro pela rede, e segue o fluxo padrão do Supabase Auth — o
// usuário final recebe/usa o link para definir a própria senha nova.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
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
  if (cargo !== 'admin_master' && cargo !== 'admin' && cargo !== 'gerente') {
    return NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', params.id)
    .single();

  const email = (targetProfile as { email: string } | null)?.email;
  if (!email) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ link: data.properties?.action_link });
}
