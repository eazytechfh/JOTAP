export interface LeadExcluido {
  id: number;
}

export interface EstadoBotConfirmado {
  id: number;
  bot_ativo: boolean;
  bot_ativo_alterado_em: string;
}

export interface TravaDeMutacao {
  tentarAdquirir: () => boolean;
  liberar: () => void;
}

export function criarTravaDeMutacao(): TravaDeMutacao {
  let ocupada = false;
  return {
    tentarAdquirir() {
      if (ocupada) return false;
      ocupada = true;
      return true;
    },
    liberar() {
      ocupada = false;
    },
  };
}

export function isLeadIdValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0;
}

export function normalizarBotAtivo(valor: unknown): boolean {
  if (valor === true) return true;
  if (typeof valor !== 'string') return false;
  return ['true', 'ativo', '1', 'sim'].includes(valor.trim().toLowerCase());
}

export function formatarUltimaAlteracaoBot(valor: string | null | undefined): string {
  if (!valor) return 'não registrada';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'não registrada';
  return data.toLocaleString('pt-BR');
}

export function confirmarExclusao(leadId: number, valor: unknown): valor is LeadExcluido {
  if (!valor || typeof valor !== 'object') return false;
  return (valor as { id?: unknown }).id === leadId;
}

export function confirmarTransicaoBot(
  leadId: number,
  ativo: boolean,
  valor: unknown
): boolean {
  if (!valor || typeof valor !== 'object') return false;
  const estado = valor as {
    id?: unknown;
    bot_ativo?: unknown;
    bot_ativo_alterado_em?: unknown;
  };
  const botReconhecido =
    typeof estado.bot_ativo === 'boolean' ||
    (typeof estado.bot_ativo === 'string' &&
      ['true', 'false'].includes(estado.bot_ativo.trim().toLowerCase()));
  return (
    estado.id === leadId &&
    botReconhecido &&
    normalizarBotAtivo(estado.bot_ativo) === ativo &&
    typeof estado.bot_ativo_alterado_em === 'string' &&
    estado.bot_ativo_alterado_em.length > 0 &&
    !Number.isNaN(new Date(estado.bot_ativo_alterado_em).getTime())
  );
}
