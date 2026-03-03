-- Criar tabela de estoque de veículos
CREATE TABLE IF NOT EXISTS estoque (
  id SERIAL PRIMARY KEY,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  ano INTEGER NOT NULL,
  cor VARCHAR(50) NOT NULL,
  combustivel VARCHAR(50) NOT NULL,
  quilometragem INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'Disponível',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_estoque_marca ON estoque(marca);
CREATE INDEX IF NOT EXISTS idx_estoque_modelo ON estoque(modelo);
CREATE INDEX IF NOT EXISTS idx_estoque_status ON estoque(status);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_estoque_updated_at BEFORE UPDATE ON estoque
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
