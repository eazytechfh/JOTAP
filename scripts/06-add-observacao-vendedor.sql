-- Adicionar campo observacao_vendedor na tabela BASE_DE_LEADS
ALTER TABLE "BASE_DE_LEADS" 
ADD COLUMN IF NOT EXISTS observacao_vendedor TEXT DEFAULT '';

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_base_leads_observacao 
ON "BASE_DE_LEADS" (id_empresa, observacao_vendedor);

-- Atualizar alguns leads com observações de exemplo
UPDATE "BASE_DE_LEADS" 
SET observacao_vendedor = CASE 
  WHEN nome_lead = 'João Silva' THEN 'Cliente muito interessado, demonstrou urgência na compra. Tem preferência por cores escuras.'
  WHEN nome_lead = 'Maria Santos' THEN 'Primeira compradora, precisa de mais orientação sobre financiamento. Muito educada e pontual.'
  WHEN nome_lead = 'Pedro Costa' THEN 'Empresário sério, decisão rápida. Quer entrega urgente para viagem de negócios.'
  WHEN nome_lead = 'Ana Oliveira' THEN 'Professora, horário restrito para atendimento. Prefere contato após 18h.'
  WHEN nome_lead = 'Carlos Lima' THEN 'Jovem ansioso, primeiro carro. Pais acompanham nas decisões. Muito simpático.'
  ELSE 'Observações do vendedor sobre este lead...'
END
WHERE observacao_vendedor = '' OR observacao_vendedor IS NULL;

-- Comentário explicativo
COMMENT ON COLUMN "BASE_DE_LEADS".observacao_vendedor IS 'Observações pessoais do vendedor sobre o lead - campo editável';
