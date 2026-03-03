-- Garantir que o estágio "Pós Venda" seja adicionado corretamente

-- Remover a constraint antiga
ALTER TABLE "BASE_DE_LEADS" 
DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";

-- Verificar os valores atuais e quantos registros temos
SELECT estagio_lead, COUNT(*) as quantidade
FROM "BASE_DE_LEADS" 
GROUP BY estagio_lead
ORDER BY quantidade DESC;

-- Criar nova constraint incluindo TODOS os estágios válidos
ALTER TABLE "BASE_DE_LEADS" 
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" 
CHECK (estagio_lead IN (
  'oportunidade', 
  'em_qualificacao', 
  'em_negociacao', 
  'fechado', 
  'nao_fechou', 
  'pesquisa_atendimento', 
  'follow_up',
  'pos_venda'
));

-- Adicionar comentário explicativo
COMMENT ON CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" ON "BASE_DE_LEADS" 
IS 'Estágios válidos: oportunidade, em_qualificacao, em_negociacao, fechado, nao_fechou, pesquisa_atendimento, follow_up, pos_venda';

-- Verificar se a constraint foi criada corretamente
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'BASE_DE_LEADS_estagio_lead_check';
