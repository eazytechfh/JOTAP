-- Alinha a constraint do estágio do lead com todas as colunas válidas do kanban.
-- Execute este script no banco usado pela aplicação local.

ALTER TABLE "BASE_DE_LEADS"
DROP CONSTRAINT IF EXISTS "BASE_DE_LEADS_estagio_lead_check";

ALTER TABLE "BASE_DE_LEADS"
ADD CONSTRAINT "BASE_DE_LEADS_estagio_lead_check"
CHECK (estagio_lead IN (
  'oportunidade',
  'em_qualificacao',
  'transferidos',
  'em_negociacao',
  'fechado',
  'nao_fechou',
  'pesquisa_atendimento',
  'follow_up',
  'pos_venda'
));

COMMENT ON CONSTRAINT "BASE_DE_LEADS_estagio_lead_check" ON "BASE_DE_LEADS"
IS 'Estagios validos do kanban: oportunidade, em_qualificacao, transferidos, em_negociacao, fechado, nao_fechou, pesquisa_atendimento, follow_up, pos_venda';

SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'BASE_DE_LEADS_estagio_lead_check';
