import { describe, expect, it } from 'vitest';
import { canManageUsers, isCreatableRole } from './roles';

describe('matriz de cargos', () => {
  it.each([
    ['admin_master', true], ['admin', true], ['gerente', true], ['vendedor', false], [null, false],
  ] as const)('avalia permissão administrativa para %s', (role, expected) => {
    expect(canManageUsers(role)).toBe(expected);
  });

  it.each([
    ['admin', true], ['gerente', true], ['vendedor', true], ['admin_master', false], ['invalido', false],
  ] as const)('limita cargos criáveis para %s', (role, expected) => {
    expect(isCreatableRole(role)).toBe(expected);
  });
});
