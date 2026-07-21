import type { Cargo } from '@/types/database';

const MANAGER_ROLES = new Set<Cargo>(['admin_master', 'admin', 'gerente']);
const CREATABLE_ROLES = new Set<Cargo>(['admin', 'gerente', 'vendedor']);

export function canManageUsers(role: string | null | undefined): boolean {
  return MANAGER_ROLES.has(role as Cargo);
}

export function isCreatableRole(role: string): role is Exclude<Cargo, 'admin_master'> {
  return CREATABLE_ROLES.has(role as Cargo);
}
