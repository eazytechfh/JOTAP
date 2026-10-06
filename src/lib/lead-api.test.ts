import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { DELETE } from '../app/api/leads/[id]/route';
import { PATCH } from '../app/api/leads/[id]/ia/route';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('contratos das rotas de leads', () => {
  it('exclusão valida sessão, cargo, tenant e confirma o ID retornado', () => {
    const route = source('src/app/api/leads/[id]/route.ts');
    expect(route).toContain('auth.getUser()');
    expect(route).toContain('canManageUsers');
    expect(route).toContain(".eq('id_empresa', EMPRESA_ID)");
    expect(route).toContain(".select('id')");
    expect(route).toContain('confirmarExclusao');
  });

  it('IA valida entrada e exige transição atômica no banco', () => {
    const route = source('src/app/api/leads/[id]/ia/route.ts');
    expect(route).toContain("typeof ativo !== 'boolean'");
    expect(route).toContain('auth.getUser()');
    expect(route).toContain('canManageUsers');
    expect(route).toContain("status: 403");
    expect(route).toContain(".eq('id_empresa', EMPRESA_ID)");
    expect(route).toContain(".eq('bot_ativo', ativo ? 'false' : 'true')");
    expect(route).toContain('confirmarTransicaoBot');
    expect(route).not.toMatch(/n8n|webhook|https?:\/\//i);
  });
});

function queryResult(data: unknown, error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'delete', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return chain;
}

function supabaseMock({
  user = { id: 'user-1' },
  cargo = 'admin',
  result = null,
}: {
  user?: { id: string } | null;
  cargo?: string;
  result?: unknown;
}) {
  const profile = queryResult({ cargo });
  const leads = queryResult(result);
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => (table === 'profiles' ? profile : leads)),
    profile,
    leads,
  };
}

describe('comportamento das rotas de leads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recusa exclusão sem sessão antes de acessar tabelas', async () => {
    const client = supabaseMock({ user: null });
    vi.mocked(createClient).mockReturnValue(client as never);
    const response = await DELETE(new Request('http://local/api/leads/7'), {
      params: { id: '7' },
    });
    expect(response.status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('recusa alteração da IA para vendedor', async () => {
    const client = supabaseMock({ cargo: 'vendedor' });
    vi.mocked(createClient).mockReturnValue(client as never);
    const response = await PATCH(
      new Request('http://local/api/leads/7/ia', {
        method: 'PATCH',
        body: JSON.stringify({ ativo: true }),
      }),
      { params: { id: '7' } }
    );
    expect(response.status).toBe(403);
    expect(client.leads.update).not.toHaveBeenCalled();
  });

  it('exclui por ID e tenant e só confirma o ID retornado', async () => {
    const client = supabaseMock({ result: { id: 7 } });
    vi.mocked(createClient).mockReturnValue(client as never);
    const response = await DELETE(new Request('http://local/api/leads/7'), {
      params: { id: '7' },
    });
    expect(response.status).toBe(200);
    expect(client.leads.eq).toHaveBeenCalledWith('id', 7);
    expect(client.leads.eq).toHaveBeenCalledWith('id_empresa', 1);
  });

  it('exige o estado anterior e devolve a transição confirmada', async () => {
    const result = {
      id: 7,
      bot_ativo: 'true',
      bot_ativo_alterado_em: '2026-07-23T12:00:00.000Z',
    };
    const client = supabaseMock({ result });
    vi.mocked(createClient).mockReturnValue(client as never);
    const response = await PATCH(
      new Request('http://local/api/leads/7/ia', {
        method: 'PATCH',
        body: JSON.stringify({ ativo: true }),
      }),
      { params: { id: '7' } }
    );
    expect(response.status).toBe(200);
    expect(client.leads.eq).toHaveBeenCalledWith('id_empresa', 1);
    expect(client.leads.update).toHaveBeenCalledWith({ bot_ativo: 'true' });
    expect(client.leads.eq).toHaveBeenCalledWith('bot_ativo', 'false');
    expect(await response.json()).toEqual({ ...result, bot_ativo: true });
  });
});
