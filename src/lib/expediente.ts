// Horário comercial padrão da concessionária: seg-sex, 8h-18h. Usado para classificar se um
// lead entrou "dentro" ou "fora" do expediente, tanto no Dashboard/Leads quanto no drawer do
// Pipeline.
export function isDentroExpediente(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const hour = date.getHours();
  return hour >= 8 && hour < 18;
}
