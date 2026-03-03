-- Criar tabela de VENDEDORES
CREATE TABLE IF NOT EXISTS public."VENDEDORES" (
  id SERIAL PRIMARY KEY,
  id_empresa INTEGER NOT NULL,
  vendedor VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  atender BOOLEAN DEFAULT true,
  quantos_lead INTEGER DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_vendedores_id_empresa ON public."VENDEDORES"(id_empresa);
CREATE INDEX IF NOT EXISTS idx_vendedores_vendedor ON public."VENDEDORES"(vendedor);

-- Adicionar comentários nas colunas
COMMENT ON COLUMN public."VENDEDORES".id IS 'ID único do vendedor';
COMMENT ON COLUMN public."VENDEDORES".id_empresa IS 'ID da empresa do vendedor';
COMMENT ON COLUMN public."VENDEDORES".vendedor IS 'Nome do vendedor';
COMMENT ON COLUMN public."VENDEDORES".telefone IS 'Telefone de contato do vendedor';
COMMENT ON COLUMN public."VENDEDORES".atender IS 'Indica se o vendedor está disponível para atender';
COMMENT ON COLUMN public."VENDEDORES".quantos_lead IS 'Quantidade de leads atribuídos ao vendedor';

-- Inserir alguns vendedores de exemplo
INSERT INTO public."VENDEDORES" (id_empresa, vendedor, telefone, atender, quantos_lead)
VALUES 
  (1, 'João Silva', '(11) 98765-4321', true, 0),
  (1, 'Maria Santos', '(11) 98765-4322', true, 0),
  (1, 'Pedro Oliveira', '(11) 98765-4323', true, 0)
ON CONFLICT DO NOTHING;
