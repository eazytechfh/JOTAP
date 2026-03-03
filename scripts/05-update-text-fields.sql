-- Alterar campos de texto para suportar conteúdo longo com quebras de linha
ALTER TABLE "BASE_DE_LEADS" 
ALTER COLUMN resumo_qualificacao TYPE TEXT;

ALTER TABLE "BASE_DE_LEADS" 
ALTER COLUMN resumo_comercial TYPE TEXT;

-- Atualizar alguns leads com dados de exemplo mais realistas
UPDATE "BASE_DE_LEADS" 
SET resumo_qualificacao = CASE 
  WHEN nome_lead = 'João Silva' THEN 'Cliente interessado em financiamento para Honda Civic.
Possui renda comprovada de R$ 8.000/mês.
Primeira habilitação há 5 anos.
Busca veículo para uso familiar e trabalho.'
  WHEN nome_lead = 'Maria Santos' THEN 'Cliente com boa renda, trabalha como gerente.
Interessada em Toyota Corolla automático.
Possui Fiat Uno 2018 para entrada.
Prioriza economia de combustível.'
  WHEN nome_lead = 'Pedro Costa' THEN 'Empresário, possui empresa própria.
Busca Volkswagen Jetta para uso executivo.
Pode dar entrada de 40% do valor.
Quer entrega em até 30 dias.'
  WHEN nome_lead = 'Ana Oliveira' THEN 'Professora universitária, renda estável.
Interessada em Nissan Sentra.
Primeira compra de carro 0km.
Precisa de orientação sobre financiamento.'
  WHEN nome_lead = 'Carlos Lima' THEN 'Jovem profissional, primeiro emprego CLT.
Busca Hyundai HB20 como primeiro carro.
Pais podem ajudar com entrada.
Prioriza baixo custo de manutenção.'
  ELSE resumo_qualificacao
END
WHERE resumo_qualificacao IS NOT NULL;

UPDATE "BASE_DE_LEADS" 
SET resumo_comercial = CASE 
  WHEN nome_lead = 'João Silva' THEN 'Primeira abordagem realizada com sucesso.
Cliente demonstrou interesse real no Honda Civic.
Agendada visita para test drive na próxima semana.
Enviada proposta inicial com condições especiais.

Próximos passos:
- Confirmar test drive
- Avaliar veículo usado
- Finalizar proposta de financiamento'
  WHEN nome_lead = 'Maria Santos' THEN 'Cliente em processo de análise de crédito.
Documentação enviada para financeira.
Aguardando aprovação do financiamento.

Status atual:
- Documentos: ✓ Enviados
- Análise: 🔄 Em andamento
- Previsão: 3-5 dias úteis

Observações:
Cliente ansiosa para fechar negócio.'
  WHEN nome_lead = 'Pedro Costa' THEN 'Proposta comercial enviada e aprovada.
Cliente confirmou interesse em fechar.
Aguardando apenas assinatura do contrato.

Detalhes da venda:
- Valor: R$ 110.000,00
- Entrada: R$ 44.000,00 (40%)
- Financiamento: R$ 66.000,00
- Prazo: 48x

Entrega prevista: 15 dias.'
  WHEN nome_lead = 'Ana Oliveira' THEN 'Cliente em fase de follow-up.
Necessita reagendar visita à loja.
Demonstrou interesse mas precisa decidir.

Ações realizadas:
- Apresentação do veículo
- Explicação sobre financiamento
- Envio de material informativo

Próxima ação: Ligar em 2 dias.'
  WHEN nome_lead = 'Carlos Lima' THEN 'Lead em processo de nutrição.
Enviando materiais educativos sobre financiamento.
Cliente jovem, precisa de mais informações.

Estratégia:
- Conteúdo educativo sobre primeiro carro
- Simulações de financiamento
- Apresentação de benefícios do HB20

Status: Nutrição ativa.'
  ELSE resumo_comercial
END
WHERE resumo_comercial IS NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN "BASE_DE_LEADS".resumo_qualificacao IS 'Resumo detalhado da qualificação do lead - suporta texto longo com quebras de linha';
COMMENT ON COLUMN "BASE_DE_LEADS".resumo_comercial IS 'Resumo comercial detalhado - suporta texto longo com quebras de linha';
