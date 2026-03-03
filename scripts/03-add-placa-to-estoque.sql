-- Add placa column to estoque table
ALTER TABLE estoque
ADD COLUMN placa VARCHAR(10);

-- Add comment to the column
COMMENT ON COLUMN estoque.placa IS 'Placa do veículo';
