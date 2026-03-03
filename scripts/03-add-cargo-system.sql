-- Adicionar coluna cargo na tabela AUTORIZAÇÃO
ALTER TABLE "AUTORIZAÇÃO" 
ADD COLUMN IF NOT EXISTS cargo VARCHAR(20) DEFAULT 'convidado' 
CHECK (cargo IN ('administrador', 'convidado'));

-- Atualizar o usuário admin padrão para ter cargo de administrador
UPDATE "AUTORIZAÇÃO" 
SET cargo = 'administrador' 
WHERE email = 'admin@admin.com.br';

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_autorizacao_empresa_cargo 
ON "AUTORIZAÇÃO" (id_empresa, cargo);

-- Garantir que sempre existe pelo menos um administrador por empresa
CREATE OR REPLACE FUNCTION check_admin_exists()
RETURNS TRIGGER AS $$
BEGIN
    -- Se estamos tentando remover ou alterar o último admin
    IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.cargo != 'administrador')) 
       AND OLD.cargo = 'administrador' THEN
        
        -- Verificar se existe outro admin na mesma empresa
        IF NOT EXISTS (
            SELECT 1 FROM "AUTORIZAÇÃO" 
            WHERE id_empresa = OLD.id_empresa 
            AND cargo = 'administrador' 
            AND id != OLD.id
            AND status = 'ativo'
        ) THEN
            RAISE EXCEPTION 'Não é possível remover o último administrador da empresa';
        END IF;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para proteger o último admin
DROP TRIGGER IF EXISTS protect_last_admin ON "AUTORIZAÇÃO";
CREATE TRIGGER protect_last_admin
    BEFORE UPDATE OR DELETE ON "AUTORIZAÇÃO"
    FOR EACH ROW
    EXECUTE FUNCTION check_admin_exists();
