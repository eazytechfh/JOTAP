-- Adicionar o novo estágio "Pós Venda" ao sistema

-- Remover a constraint antiga
ALTER TABLE "BASE_DE_LEADS" 
DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";

-- Criar nova constraint incluindo o estágio "pos_venda"
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

-- Verificar se todos os registros estão válidos
SELECT estagio_lead, COUNT(*) as quantidade
FROM "BASE_DE_LEADS" 
GROUP BY estagio_lead
ORDER BY quantidade DESC;

-- Comentário explicativo
COMMENT ON CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" ON "BASE_DE_LEADS" 
IS 'Constraint atualizada com o novo estágio Pós Venda: oportunidade, em_qualificacao, em_negociacao, fechado, nao_fechou, pesquisa_atendimento, follow_up, pos_venda';
