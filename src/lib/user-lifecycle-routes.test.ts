import { beforeEach, describe, expect, it, vi } from 'vitest';

let serverClient: any;
let adminClient: any;

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => serverClient,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => adminClient,
}));

import { DELETE } from '@/app/api/users/[id]/route';

function profileClient(cargo: string) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { cargo }, error: null }),
      })),
    })),
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
  };

  adminClient = {
    from: vi.fn(() => profileClient(targetCargo)),
    auth: {
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
}

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exige autenticacao', async () => {
    requestAs(null);

    const response = await DELETE(new Request('http://localhost/api/users/target'), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(401);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('exige cargo de gestao', async () => {
    requestAs('requester', 'vendedor');

    const response = await DELETE(new Request('http://localhost/api/users/target'), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(403);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('impede autoexclusao', async () => {
    requestAs('same-user');

    const response = await DELETE(new Request('http://localhost/api/users/same-user'), {
      params: { id: 'same-user' },
    });

    expect(response.status).toBe(400);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('impede excluir admin master', async () => {
    requestAs('requester', 'admin', 'admin_master');

    const response = await DELETE(new Request('http://localhost/api/users/master'), {
      params: { id: 'master' },
    });

    expect(response.status).toBe(403);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('exclui pelo Auth administrativo e confirma somente no sucesso', async () => {
    requestAs('requester');

    const response = await DELETE(new Request('http://localhost/api/users/target'), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(200);
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith('target');
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('propaga falha do Auth sem confirmar exclusao', async () => {
    requestAs('requester');
    adminClient.auth.admin.deleteUser.mockResolvedValue({ error: { message: 'auth failure' } });

    const response = await DELETE(new Request('http://localhost/api/users/target'), {
      params: { id: 'target' },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'auth failure' });
  });
});
