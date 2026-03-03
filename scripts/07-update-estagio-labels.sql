-- Atualizar os estágios existentes no banco de dados
UPDATE "BASE_DE_LEADS" 
SET estagio_lead = 'em_negociacao' 
WHERE estagio_lead = 'qualificado';

UPDATE "BASE_DE_LEADS" 
SET estagio_lead = 'pesquisa_atendimento' 
WHERE estagio_lead = 'nutricao';

-- Atualizar a constraint para incluir os novos valores
ALTER TABLE "BASE_DE_LEADS" 
DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";

ALTER TABLE "BASE_DE_LEADS" 
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" 
CHECK (estagio_lead IN ('oportunidade', 'em_qualificacao', 'em_negociacao', 'fechado', 'nao_fechou', 'pesquisa_atendimento', 'follow_up'));

-- Comentários explicativos
COMMENT ON CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" ON "BASE_DE_LEADS" IS 'Novos estágios: qualificado->em_negociacao, nutricao->pesquisa_atendimento';
