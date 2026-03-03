-- Adicionar campo valor na tabela BASE_DE_LEADS
ALTER TABLE "BASE_DE_LEADS" 
ADD COLUMN IF NOT EXISTS valor DECIMAL(15,2) DEFAULT 0.00;

-- Criar índice para melhorar performance nas consultas de valor
CREATE INDEX IF NOT EXISTS idx_base_leads_valor 
ON "BASE_DE_LEADS" (valor);

-- Atualizar alguns leads existentes com valores de exemplo
UPDATE "BASE_DE_LEADS" 
SET valor = CASE 
  WHEN veiculo_interesse LIKE '%Civic%' THEN 85000.00
  WHEN veiculo_interesse LIKE '%Corolla%' THEN 95000.00
  WHEN veiculo_interesse LIKE '%Jetta%' THEN 110000.00
  WHEN veiculo_interesse LIKE '%Sentra%' THEN 78000.00
  WHEN veiculo_interesse LIKE '%HB20%' THEN 65000.00
  ELSE 75000.00
END
WHERE valor = 0.00;

-- Comentário explicativo
COMMENT ON COLUMN "BASE_DE_LEADS".valor IS 'Valor estimado do negócio em reais';
