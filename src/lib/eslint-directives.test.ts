import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('nao referencia regras ESLint de plugins que o projeto nao configura', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/users/[id]/route.ts'), 'utf8');

  expect(route).not.toContain('@typescript-eslint/no-explicit-any');
});
