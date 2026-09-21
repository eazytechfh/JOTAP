import { NextResponse } from 'next/server';
import { canManageUsers } from '@/lib/auth/roles';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { destinoRedistribuicao, REDISTRIBUIR_IGUALMENTE } from '@/lib/vendedores/redistribuicao';

type VendedorRow = { id: number; vendedor: string; id_empresa: string | null };

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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
    .select('cargo, nome')
    .eq('id', params.id)
    .single();

  if (targetError || !targetProfile) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const target = targetProfile as { cargo: string; nome: string | null };

  if (target.cargo === 'admin_master') {
    return NextResponse.json({ error: 'A conta admin master não pode ser excluída.' }, { status: 403 });
  }

  // Body opcional: { redistribuirPara?: string | null }. Ausente/nulo mantém o comportamento
  // atual (leads ficam sem vendedor). Um nome de vendedor faz uma realocação direta. A
  // sentinela REDISTRIBUIR_IGUALMENTE aciona a RPC redistribuir_leads já usada na página de leads.
  let redistribuirParaBruto: unknown = null;
  try {
    const body = await request.json();
    redistribuirParaBruto = (body as { redistribuirPara?: unknown } | null)?.redistribuirPara ?? null;
  } catch {
    redistribuirParaBruto = null;
  }

  if (redistribuirParaBruto && target.cargo === 'vendedor' && target.nome) {
    let destino: string | null;
    try {
      destino = destinoRedistribuicao(redistribuirParaBruto, target.nome);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Destino de redistribuição inválido.' },
        { status: 400 }
      );
    }

    if (destino) {
      const { data: sellerRow, error: sellerError } = await admin
        .from('VENDEDORES')
        .select('id, vendedor, id_empresa')
        .eq('user_id', params.id)
        .maybeSingle();

      if (sellerError) {
        return NextResponse.json({ error: sellerError.message }, { status: 400 });
      }

      const seller = sellerRow as VendedorRow | null;

      // Se não há linha operacional vinculada (vendedor legado sem user_id, por exemplo), não há
      // como localizar os leads com segurança por nome sem risco de ambiguidade — mantém o
      // comportamento atual de deixar os leads como estão.
      if (seller) {
        if (destino === REDISTRIBUIR_IGUALMENTE) {
          const resultado = await redistribuirIgualmente(admin, supabase, seller);
          if (resultado?.error) {
            return NextResponse.json({ error: resultado.error }, { status: 400 });
          }
        } else {
          const resultado = await redistribuirParaVendedor(admin, seller, destino);
          if (resultado?.error) {
            return NextResponse.json({ error: resultado.error }, { status: 400 });
          }
        }
      }
    }
  }

  // O trigger cleanup_deleted_auth_user remove VENDEDORES e usuarios na mesma
  // transacao, incluindo profiles.
  const { error: deleteError } = await admin.auth.admin.deleteUser(params.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- clientes Supabase tipados via genéricos do SDK, sem schema local aqui.
async function redistribuirIgualmente(admin: any, supabase: any, seller: VendedorRow): Promise<{ error: string } | null> {
  // A RPC `redistribuir_leads` elege os destinatários a partir de VENDEDORES.ativo = true.
  // Neste ponto da requisição o vendedor sendo excluído ainda está ativo — o delete do usuário
  // de Auth (e o trigger cleanup_deleted_auth_user que remove a linha de VENDEDORES) só
  // acontece depois. Por isso desativamos a linha ANTES de chamar a RPC, garantindo que o
  // próprio vendedor excluído não seja contado como destinatário elegível.
  const { error: desativarError } = await admin.from('VENDEDORES').update({ ativo: false }).eq('id', seller.id);
  if (desativarError) return { error: desativarError.message };

  let leadsQuery = admin.from('BASE_DE_LEADS').select('id').eq('vendedor', seller.vendedor);
  if (seller.id_empresa !== null && seller.id_empresa !== undefined) {
    leadsQuery = leadsQuery.eq('id_empresa', Number(seller.id_empresa));
  }
  const { data: leadRows, error: leadsError } = await leadsQuery;

  if (leadsError) {
    await admin.from('VENDEDORES').update({ ativo: true }).eq('id', seller.id);
    return { error: leadsError.message };
  }

  const leadIds = ((leadRows as { id: number }[] | null) ?? []).map((lead) => lead.id);
  if (leadIds.length === 0) return null;

  // A RPC valida a permissão do usuário autenticado (auth.uid()) e distribui os leads entre os
  // vendedores ativos restantes; por isso é chamada com o cliente autenticado da requisição
  // (supabase), não com o cliente administrativo (que não carrega sessão de usuário).
  const { error: rpcError } = await supabase.rpc('redistribuir_leads', { p_lead_ids: leadIds });
  if (rpcError) {
    await admin.from('VENDEDORES').update({ ativo: true }).eq('id', seller.id);
    return { error: rpcError.message };
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- clientes Supabase tipados via genéricos do SDK, sem schema local aqui.
async function redistribuirParaVendedor(admin: any, seller: VendedorRow, destinoNome: string): Promise<{ error: string } | null> {
  let destinoQuery = admin
    .from('VENDEDORES')
    .select('vendedor')
    .eq('ativo', true)
    .ilike('vendedor', destinoNome);
  if (seller.id_empresa !== null && seller.id_empresa !== undefined) {
    destinoQuery = destinoQuery.eq('id_empresa', seller.id_empresa);
  }
  const { data: destinoRow, error: destinoError } = await destinoQuery.maybeSingle();

  if (destinoError) return { error: destinoError.message };

  const destinoSeller = destinoRow as { vendedor: string } | null;
  if (!destinoSeller) return { error: 'Vendedor de destino não encontrado ou inativo.' };

  let updateQuery = admin
    .from('BASE_DE_LEADS')
    .update({ vendedor: destinoSeller.vendedor, updated_at: new Date().toISOString() })
    .eq('vendedor', seller.vendedor);
  if (seller.id_empresa !== null && seller.id_empresa !== undefined) {
    updateQuery = updateQuery.eq('id_empresa', Number(seller.id_empresa));
  }
  const { error: updateError } = await updateQuery;

  if (updateError) return { error: updateError.message };
  return null;
}
