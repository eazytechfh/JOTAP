-- Remover a constraint antiga
ALTER TABLE "BASE_DE_LEADS" 
DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";

-- Verificar os valores atuais na tabela
SELECT DISTINCT estagio_lead FROM "BASE_DE_LEADS";

-- Atualizar valores inconsistentes se existirem
UPDATE "BASE_DE_LEADS" 
SET estagio_lead = 'em_negociacao' 
WHERE estagio_lead = 'qualificado';

UPDATE "BASE_DE_LEADS" 
SET estagio_lead = 'pesquisa_atendimento' 
WHERE estagio_lead = 'nutricao';

-- Criar nova constraint com todos os valores corretos
ALTER TABLE "BASE_DE_LEADS" 
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" 
CHECK (estagio_lead IN (
  'oportunidade', 
  'em_qualificacao', 
  'em_negociacao', 
  'fechado', 
  'nao_fechou', 
  'pesquisa_atendimento', 
  'follow_up'
));

-- Verificar se todos os registros estão válidos
SELECT estagio_lead, COUNT(*) as quantidade
FROM "BASE_DE_LEADS" 
GROUP BY estagio_lead
ORDER BY quantidade DESC;

-- Comentário explicativo
COMMENT ON CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" ON "BASE_DE_LEADS" 
IS 'Constraint atualizada com os novos estágios: oportunidade, em_qualificacao, em_negociacao, fechado, nao_fechou, pesquisa_atendimento, follow_up';
