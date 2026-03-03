-- Adiciona os novos cargos 'vendedor' e 'gerente' à tabela usuarios
-- Remove a constraint antiga e cria uma nova com os cargos adicionais

-- Remove a constraint existente (se houver)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_check;

-- Adiciona a nova constraint com os novos cargos
ALTER TABLE usuarios ADD CONSTRAINT usuarios_cargo_check 
  CHECK (cargo IN ('administrador', 'convidado', 'vendedor', 'gerente'));

-- Atualiza o comentário da coluna
COMMENT ON COLUMN usuarios.cargo IS 'Cargo do usuário: administrador, gerente, vendedor ou convidado';
