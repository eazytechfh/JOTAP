import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REDISTRIBUIR_IGUALMENTE } from '@/lib/vendedores/redistribuicao';

let serverClient: any;
let adminClient: any;

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => serverClient,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => adminClient,
}));

import { DELETE } from '@/app/api/users/[id]/route';

function profileClient(cargo: string, nome: string | null = null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { cargo, nome }, error: null }),
      })),
    })),
  };
}

// Constrói um cliente admin cujas tabelas (além de `profiles`) respondem com resultados
// enfileirados por tabela, consumidos na ordem em que a rota chama `.from(tabela)`. Isso evita
// ter que distinguir select/update/maybeSingle no mock: cada chamada a `.from()` simplesmente
// consome o próximo resultado da fila daquela tabela, seja ela resolvida via `.maybeSingle()`
// ou aguardada diretamente (`await query`).
function buildAdminClient(
  targetCargo: string,
  targetNome: string | null,
  queueByTable: Record<string, Array<{ data: unknown; error: unknown }>> = {},
  deleteUserResult: { error: unknown } = { error: null }
) {
  const counters: Record<string, number> = {};

  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return profileClient(targetCargo, targetNome);
    }

    const idx = counters[table] ?? 0;
    counters[table] = idx + 1;
    const result = queueByTable[table]?.[idx] ?? { data: null, error: null };

    const builder: any = {
      select: vi.fn(() => builder),
      update: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      maybeSingle: vi.fn().mockResolvedValue(result),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return builder;
  });

  return {
    from,
    auth: {
      admin: {
        deleteUser: vi.fn().mockResolvedValue(deleteUserResult),
      },
    },
  };
}

function requestAs(userId: string | null, requesterCargo = 'admin', targetCargo = 'vendedor') {
  serverClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: vi.fn(() => profileClient(requesterCargo)),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  adminClient = buildAdminClient(targetCargo, null);
}

function deleteRequest(id: string, body?: unknown) {
  return new Request(`http://localhost/api/users/${id}`, {
    method: 'DELETE',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
}

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exige autenticacao', async () => {
    requestAs(null);

    const response = await DELETE(deleteRequest('target'), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(401);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('exige cargo de gestao', async () => {
    requestAs('requester', 'vendedor');

    const response = await DELETE(deleteRequest('target'), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(403);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('impede autoexclusao', async () => {
    requestAs('same-user');

    const response = await DELETE(deleteRequest('same-user'), {
      params: { id: 'same-user' },
    });

    expect(response.status).toBe(400);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('impede excluir admin master', async () => {
    requestAs('requester', 'admin', 'admin_master');

    const response = await DELETE(deleteRequest('master'), {
      params: { id: 'master' },
    });

    expect(response.status).toBe(403);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('exclui pelo Auth administrativo e confirma somente no sucesso', async () => {
    requestAs('requester');

    const response = await DELETE(deleteRequest('target'), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(200);
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('target');
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('propaga falha do Auth sem confirmar exclusao', async () => {
    requestAs('requester');
    adminClient.auth.admin.deleteUser.mockResolvedValue({ error: { message: 'auth failure' } });

    const response = await DELETE(deleteRequest('target'), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'auth failure' });
  });

  it('sem redistribuirPara no corpo, mantem comportamento atual (leads ficam sem vendedor)', async () => {
    requestAs('requester');

    const response = await DELETE(deleteRequest('target', { redistribuirPara: null }), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(200);
    expect(adminClient.from).toHaveBeenCalledWith('profiles');
    expect(adminClient.from).not.toHaveBeenCalledWith('VENDEDORES');
    expect(adminClient.from).not.toHaveBeenCalledWith('BASE_DE_LEADS');
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('target');
  });

  it('redistribui diretamente para um vendedor especifico antes de excluir', async () => {
    serverClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'requester' } } }) },
      from: vi.fn(() => profileClient('admin')),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    adminClient = buildAdminClient('vendedor', 'Carlos Vendedor', {
      VENDEDORES: [
        { data: { id: 1, vendedor: 'Carlos Vendedor', id_empresa: '1' }, error: null }, // lookup do vendedor excluido
        { data: { vendedor: 'Ana Vendedora' }, error: null }, // lookup do destino
      ],
      BASE_DE_LEADS: [{ data: null, error: null }], // update direto dos leads
    });

    const response = await DELETE(deleteRequest('target', { redistribuirPara: 'Ana Vendedora' }), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(200);
    expect(adminClient.from).toHaveBeenCalledWith('VENDEDORES');
    expect(adminClient.from).toHaveBeenCalledWith('BASE_DE_LEADS');
    expect(serverClient.rpc).not.toHaveBeenCalled();
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('target');
  });

  it('recusa redistribuir para o proprio vendedor que esta sendo excluido', async () => {
    serverClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'requester' } } }) },
      from: vi.fn(() => profileClient('admin')),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    adminClient = buildAdminClient('vendedor', 'Carlos Vendedor');

    const response = await DELETE(deleteRequest('target', { redistribuirPara: 'Carlos Vendedor' }), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(400);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('distribui igualmente: desativa o vendedor antes de chamar a RPC e exclui apos sucesso', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ lead_id: 10, vendedor: 'Ana Vendedora' }], error: null });
    serverClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'requester' } } }) },
      from: vi.fn(() => profileClient('admin')),
      rpc,
    };

    adminClient = buildAdminClient('vendedor', 'Carlos Vendedor', {
      VENDEDORES: [
        { data: { id: 1, vendedor: 'Carlos Vendedor', id_empresa: '1' }, error: null }, // lookup do vendedor excluido
        { data: null, error: null }, // update ativo=false
      ],
      BASE_DE_LEADS: [{ data: [{ id: 10 }], error: null }], // leads do vendedor excluido
    });

    const response = await DELETE(deleteRequest('target', { redistribuirPara: REDISTRIBUIR_IGUALMENTE }), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('redistribuir_leads', { p_lead_ids: [10] });

    // A ordem das chamadas a VENDEDORES precisa desativar o vendedor ANTES de chamar a RPC,
    // senão a RPC (que elege destinatarios por VENDEDORES.ativo = true) poderia devolver leads
    // ao proprio vendedor que esta sendo excluido.
    const vendedoresCalls = adminClient.from.mock.calls.filter(([table]: [string]) => table === 'VENDEDORES').length;
    expect(vendedoresCalls).toBe(2);

    const rpcCallOrder = rpc.mock.invocationCallOrder[0];
    // from() calls, em ordem: profiles (0), VENDEDORES lookup do vendedor (1), VENDEDORES
    // update ativo=false (2), BASE_DE_LEADS select dos leads (3).
    const deactivateBuilder = adminClient.from.mock.results[2].value;
    const deactivateCallOrder = deactivateBuilder.update.mock.invocationCallOrder[0];
    expect(deactivateCallOrder).toBeLessThan(rpcCallOrder);

    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('target');
  });

  it('nao chama a RPC quando o vendedor excluido nao possui leads', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    serverClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'requester' } } }) },
      from: vi.fn(() => profileClient('admin')),
      rpc,
    };

    adminClient = buildAdminClient('vendedor', 'Carlos Vendedor', {
      VENDEDORES: [
        { data: { id: 1, vendedor: 'Carlos Vendedor', id_empresa: '1' }, error: null },
        { data: null, error: null },
      ],
      BASE_DE_LEADS: [{ data: [], error: null }],
    });

    const response = await DELETE(deleteRequest('target', { redistribuirPara: REDISTRIBUIR_IGUALMENTE }), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('target');
  });

  it('reativa o vendedor e nao exclui o usuario se a RPC de redistribuicao falhar', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc failure' } });
    serverClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'requester' } } }) },
      from: vi.fn(() => profileClient('admin')),
      rpc,
    };

    adminClient = buildAdminClient('vendedor', 'Carlos Vendedor', {
      VENDEDORES: [
        { data: { id: 1, vendedor: 'Carlos Vendedor', id_empresa: '1' }, error: null },
        { data: null, error: null }, // desativa
        { data: null, error: null }, // reativa apos falha
      ],
      BASE_DE_LEADS: [{ data: [{ id: 10 }], error: null }],
    });

    const response = await DELETE(deleteRequest('target', { redistribuirPara: REDISTRIBUIR_IGUALMENTE }), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'rpc failure' });
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();

    const vendedoresCalls = adminClient.from.mock.calls.filter(([table]: [string]) => table === 'VENDEDORES').length;
    expect(vendedoresCalls).toBe(3);
  });
});
