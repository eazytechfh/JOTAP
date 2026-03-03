-- Atualizar a tabela AUTORIZAÇÃO para garantir que o campo status tenha as opções corretas
ALTER TABLE "AUTORIZAÇÃO" 
DROP CONSTRAINT IF EXISTS "AUTORIZAÇÃO_status_check";

ALTER TABLE "AUTORIZAÇÃO" 
ADD CONSTRAINT "AUTORIZAÇÃO_status_check" 
CHECK (status IN ('ativo', 'pendente', 'inativo'));

-- Garantir que todos os registros existentes tenham status válido
UPDATE "AUTORIZAÇÃO" 
SET status = 'ativo' 
WHERE status NOT IN ('ativo', 'pendente', 'inativo');

-- Criar índice para melhorar performance nas consultas de login
CREATE INDEX IF NOT EXISTS idx_autorizacao_email_status 
ON "AUTORIZAÇÃO" (email, status);

CREATE INDEX IF NOT EXISTS idx_autorizacao_empresa_status 
ON "AUTORIZAÇÃO" (id_empresa, status);
