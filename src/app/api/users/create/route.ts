import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canManageUsers, isCreatableRole } from '@/lib/auth/roles';

export async function POST(request: Request) {
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

  const body = await request.json();
  const { email, password, nome, novoCargo, telefone } = body as {
    email: string;
    password: string;
    nome: string;
    novoCargo: string;
    telefone?: string;
  };

  if (!email || !password || !nome || !novoCargo) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
  }

  // admin_master é uma role oculta de uso exclusivo dos desenvolvedores — nunca pode ser
  // atribuída através da API de criação de usuário, mesmo que alguém manipule a requisição.
  if (!isCreatableRole(novoCargo)) {
    return NextResponse.json({ error: 'Cargo inválido.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, cargo: novoCargo, telefone },
    app_metadata: { cargo: novoCargo },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ user: data.user });
}
