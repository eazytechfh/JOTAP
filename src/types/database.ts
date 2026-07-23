/**
 * Tipos das tabelas do banco Supabase usados pelo EazyClick CRM.
 *
 * IMPORTANTE: várias colunas das tabelas reais possuem espaços e/ou acentos no nome
 * (ex: "Status de Follow", "ID VEICULO", "Pesquisa de satisfação"). TypeScript não aceita
 * identificadores de propriedade com espaços de forma ergonômica, então as interfaces abaixo
 * usam nomes em camelCase/PascalCase como apelido de desenvolvimento. Ao escrever queries reais
 * contra o Supabase (`.select()`, `.eq()`, `.order()` etc.), é OBRIGATÓRIO usar a string EXATA
 * do nome da coluna real, entre aspas duplas, exatamente como documentado no JSDoc de cada
 * campo. Exemplos:
 *   supabase.from('BASE_DE_LEADS').select('"Etapa", "ID CONTATO CLICK"')
 *   supabase.from('BASE_DE_LEADS').update({ ... }).eq('"Status de Follow"', 'pendente')
 * Não há mapeamento automático de nomes — isso é proposital, para manter a camada de tipos
 * simples e deixar explícito, em cada query, qual é o nome real da coluna no banco.
 */

export interface BaseDeLeads {
  id: number;
  id_empresa: number;
  nome_lead: string;
  telefone: string;
  email: string | null;
  origem: string | null;
  vendedor: string | null;
  veiculo_interesse: string | null;
  resumo_qualificacao: string | null;
  estagio_lead: string;
  resumo_comercial: string | null;
  created_at: string;
  updated_at: string | null;
  valor: number | null;
  observacao_vendedor: string | null;
  bot_ativo: string;
  bot_ativo_alterado_em: string | null;
  /** Coluna real: "Etapa" */
  Etapa: string | null;
  /** Coluna real: "QuemEnviouMsg" */
  QuemEnviouMsg: string | null;
  /** Coluna real: "UltimaMensagem" */
  UltimaMensagem: string | null;
  /** Coluna real: "Status de Follow" */
  StatusDeFollow: string | null;
  /** Coluna real: "Transferencia" */
  Transferencia: string | null;
  /** Coluna real: "Pesquisa de satisfação" */
  PesquisaDeSatisfacao: string | null;
  /** Coluna real: "ID CONTATO CLICK" */
  IdContatoClick: string | null;
  lid: string | null;
  /** Coluna real: "Data e Hora" */
  DataEHora: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  score_serasa: number | null;
  follow_manual: 'ativo' | 'inativo' | string | null;
  /** Prazo do cronômetro de 30min de "Em Negociação"; null quando o lead não está nesse estágio. */
  negociacao_expira_em: string | null;
  /** Marca quando o popup/notificação de expiração já foi disparado, para não repetir. */
  negociacao_notificado_em: string | null;
  /** Quantas vezes gerente/admin estenderam o cronômetro em +30min. */
  negociacao_extensoes: number;
  /** Estado do envio ao webhook do n8n: 'enviando' | 'erro' | 'enviado' | null. */
  negociacao_notificacao_status: string | null;
  /** Quantas vezes o sistema tentou reivindicar/enviar a notificação deste lead. */
  negociacao_notificacao_tentativas: number;
  /** Última mensagem de erro ao tentar notificar (ex: webhook fora do ar, env var ausente). */
  negociacao_notificacao_erro: string | null;
  /** Timestamp de quando um processo reivindicou o envio (evita duplo disparo concorrente). */
  negociacao_notificacao_reivindicada_em: string | null;
}

export interface LeadEtiqueta {
  id: number;
  id_lead: number;
  id_etiqueta: number;
  created_at: string;
}

export interface LeadHistoricoEstagio {
  id: number;
  id_lead: number;
  estagio_anterior: string | null;
  estagio_novo: string;
  usuario: string | null;
  created_at: string;
}

export interface Vendedor {
  id: number;
  created_at: string;
  vendedor: string | null;
  telefone: string | null;
  atender: string | null;
  quantos_lead: number | null;
  id_click: string | null;
  id_empresa: string | null;
}

export interface Estoque {
  id: number;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  cor: string | null;
  combustivel: string | null;
  quilometragem: number | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  placa: string | null;
  /** Coluna real: "link imagem 0" */
  linkImagem0: string | null;
  valor: string | null;
  motor: string | null;
  /** Coluna real: "link imagem 1" */
  linkImagem1: string | null;
  /** Coluna real: "link imagem 2" */
  linkImagem2: string | null;
  /** Coluna real: "link imagem 3" */
  linkImagem3: string | null;
  /** Coluna real: "ID VEICULO" */
  idVeiculo: string | null;
  tipo: string | null;
}

// As tabelas abaixo (AGENDAMENTOS, HISTORICO_VISITAS, HISTORICO_CHAT, AUTORIZAÇÃO) ainda não
// têm tela dedicada no CRM. As interfaces são apenas estimativas razoáveis de schema para uso
// futuro — quando as telas forem implementadas, revisar contra o schema real do banco.

export interface Agendamento {
  id: number;
  created_at: string;
  id_lead: number | null;
  data: string | null;
  observacao: string | null;
}

export interface HistoricoVisita {
  id: number;
  created_at: string;
  id_lead: number | null;
  data: string | null;
  observacao: string | null;
}

export interface HistoricoChat {
  id: number;
  created_at: string;
  id_lead: number | null;
  mensagem: string | null;
  remetente: string | null;
}

/** Tabela real: "AUTORIZAÇÃO" */
export interface Autorizacao {
  id: number;
  created_at: string;
  id_lead: number | null;
  data: string | null;
  observacao: string | null;
}

// admin_master é uma role oculta de uso exclusivo dos desenvolvedores (senha padrão interna),
// nunca exposta como opção criável nos formulários de usuário do CRM.
export type Cargo = 'admin_master' | 'admin' | 'gerente' | 'vendedor';

export interface Profile {
  id: string;
  nome: string | null;
  email: string;
  cargo: Cargo;
  created_at: string;
  desativado: boolean;
}

export interface AppSettings {
  id: number;
  uazapi_token: string | null;
  uazapi_base_url: string;
  updated_at: string | null;
}

export interface Etiqueta {
  id: number;
  nome: string;
  cor: string;
  created_at: string;
}
