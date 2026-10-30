// Analisa todas as conversas de uma location do GoHighLevel (GHL) e gera:
// - classificação de cada lead (quente / morno / frio) com base no texto das conversas;
// - tempo até o vendedor atribuído (proprietário) iniciar o atendimento na conversa;
// - totais por temperatura, leads distribuídos por vendedor e veículos mais procurados.
//
// Uso:
//   GHL_TOKEN=pit-... GHL_LOCATION_ID=... node scripts/ghl-analise-conversas.mjs [--desde=AAAA-MM-DD] [--saida=relatorios-ghl]
// As variáveis também podem ficar em .env.local. Requer Node 20.12+ e nenhuma dependência.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local é opcional quando as variáveis vêm do ambiente.
}

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=') || true];
}));

const TOKEN = process.env.GHL_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const BASE_URL = (process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com').replace(/\/$/, '');
const DESDE = args.desde ? new Date(`${args.desde}T00:00:00`) : null;
const SAIDA = args.saida || 'relatorios-ghl';
if (!TOKEN || !LOCATION_ID) throw new Error('Defina GHL_TOKEN e GHL_LOCATION_ID (ambiente ou .env.local).');
if (DESDE && Number.isNaN(DESDE.getTime())) throw new Error('--desde inválido, use AAAA-MM-DD.');

// ---------------------------------------------------------------------------
// Cliente HTTP (limite do GHL: 100 requisições / 10s por location)
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

async function ghl(pathname, params = {}, version = '2021-04-15') {
  const url = new URL(BASE_URL + pathname);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  for (let attempt = 1; ; attempt += 1) {
    const wait = lastRequestAt + 120 - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Version: version, Accept: 'application/json' },
    });
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < 6) {
      await sleep(Number(response.headers.get('retry-after')) * 1000 || 2000 * attempt);
      continue;
    }
    throw new Error(`GHL ${response.status} em ${url.pathname}: ${(await response.text()).slice(0, 300)}`);
  }
}

async function listarUsuarios() {
  try {
    const data = await ghl('/users/', { locationId: LOCATION_ID }, '2021-07-28');
    return new Map((data.users || []).map((user) => [
      user.id,
      user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user.id,
    ]));
  } catch (error) {
    console.warn(`Aviso: não foi possível listar usuários (${error.message}). Vendedores aparecerão pelo ID.`);
    return new Map();
  }
}

async function listarConversas() {
  const conversas = [];
  let startAfterDate;
  for (;;) {
    const data = await ghl('/conversations/search', {
      locationId: LOCATION_ID, limit: 100, sortBy: 'last_message_date', sort: 'desc', startAfterDate,
    });
    const page = data.conversations || [];
    conversas.push(...page);
    process.stdout.write(`\rConversas carregadas: ${conversas.length}${data.total ? `/${data.total}` : ''}`);
    if (page.length < 100 || (data.total && conversas.length >= data.total)) break;
    const last = page[page.length - 1];
    const next = last.sort?.[0] ?? last.lastMessageDate;
    if (!next || next === startAfterDate) break;
    startAfterDate = next;
    if (DESDE && Number(next) < DESDE.getTime()) break;
  }
  process.stdout.write('\n');
  return conversas;
}

async function listarMensagens(conversationId) {
  const mensagens = [];
  let lastMessageId;
  for (;;) {
    const data = await ghl(`/conversations/${conversationId}/messages`, { limit: 100, lastMessageId });
    const bloco = data.messages || {};
    const page = Array.isArray(bloco) ? bloco : bloco.messages || [];
    mensagens.push(...page);
    if (!bloco.nextPage || !bloco.lastMessageId || page.length === 0) break;
    lastMessageId = bloco.lastMessageId;
  }
  return mensagens.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
}

// ---------------------------------------------------------------------------
// Análise de texto
// ---------------------------------------------------------------------------

const normalizar = (texto) => String(texto || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ');

// Sinais de lead quente (texto já normalizado, sem acentos).
const SINAIS_QUENTE = {
  'agendou visita': [
    /\b(agend(ar|ei|ado|ada|amos|ou)|marc(ar|ei|ado|ada|amos|ou))\b.{0,40}\b(visita|horario|test ?drive|ai na loja|na loja|amanha|hoje|sabado|segunda|terca|quarta|quinta|sexta)\b/,
    /\b(visita|test ?drive)\b.{0,30}\b(agendad|marcad|confirmad)/,
    /\b(vou|vamos|posso|consigo|passo|passar|irei|estarei)\b.{0,25}\b(ai|na loja|ate ai|ate a loja|conhecer o carro|ver o carro|ver pessoalmente)\b/,
    /\b(que horas|qual horario|horario de funcionamento|endereco da loja|qual o endereco|manda a localizacao|me manda o endereco)\b/,
  ],
  'carro na troca': [
    /\b(troca|trocar|na troca|pra troca|para troca|dar na troca|dar de troca|aceita troca|aceitam troca|pega troca|pegam troca|pegar meu carro|avaliar meu carro|avaliacao do meu|meu carro na)\b/,
    /\btenho (um|uma)\b.{0,30}\b(pra|para) (dar|trocar|troca)\b/,
  ],
  'valor de entrada': [
    /\bentrada\b.{0,30}\b(\d|mil|reais|r\$)/,
    /(\d|mil|r\$).{0,25}\bde entrada\b/,
    /\b(tenho|dou|daria|consigo dar|posso dar)\b.{0,25}\bentrada\b/,
  ],
  'pagamento a vista': [
    /\ba vista\b/,
    /\b(pagar|pago|pagamento) (em|no) (dinheiro|pix)\b/,
    /\bpix\b.{0,20}\b(total|valor total|tudo)\b/,
  ],
};

const SINAIS_MORNO = [
  /\b(vou|preciso|vamos|deixa eu|deixe eu|tenho que) (pensar|analisar|avaliar|ver direitinho|decidir|refletir)\b/,
  /\b(vou|preciso|tenho que|deixa eu|deixe eu) (ver|conversar|falar|consultar|decidir)\b.{0,20}\b(com )?(a |o |minha |meu )?(esposa|marido|mulher|namorad[ao]|familia|pai|mae|filh[ao]|irma[o]?|socio|sogr[ao])\b/,
  /\b(depois (te|eu) (falo|aviso|retorno|chamo)|te (retorno|aviso|dou um retorno)|qualquer coisa (te )?(chamo|falo|aviso)|mais pra frente|mais para frente|ainda nao (sei|decidi)|to (indecis|em duvida)|estou (indecis|em duvida)|vou dar uma olhada|so pesquisando|so olhando|estou pesquisando)\b/,
  /\b(achei caro|ta caro|muito caro|fora do (meu )?orcamento|nao (tenho|consigo).{0,15}entrada|vou juntar)\b/,
];

// Modelos mais comuns no varejo de usados no Brasil (nome exibido -> padrão de busca).
const VEICULOS = [
  ['Corolla Cross', /\bcorolla cross\b/], ['Corolla', /\bcorolla\b(?! cross)/], ['Hilux SW4', /\b(sw4|sw 4|hilux sw4)\b/],
  ['Hilux', /\bhilux\b(?! sw)/], ['Yaris', /\byaris\b/], ['Etios', /\betios\b/], ['RAV4', /\brav ?4\b/],
  ['Onix Plus', /\bonix plus\b/], ['Onix', /\bonix\b(?! plus)/], ['Prisma', /\bprisma\b/], ['Cruze', /\bcruze\b/],
  ['Tracker', /\btracker\b/], ['S10', /\bs ?10\b/], ['Spin', /\bspin\b/], ['Montana', /\bmontana\b/],
  ['Cobalt', /\bcobalt\b/], ['Celta', /\bcelta\b/], ['Corsa', /\bcorsa\b/], ['Equinox', /\bequinox\b/],
  ['Trailblazer', /\btrailblazer\b/], ['Agile', /\bagile\b/], ['Classic', /\bclassic\b/],
  ['HB20S', /\bhb ?20 ?s\b/], ['HB20', /\bhb ?20\b(?! ?s\b)/], ['Creta', /\bcreta\b/], ['Tucson', /\btucson\b/],
  ['ix35', /\bix ?35\b/], ['Santa Fe', /\bsanta fe\b/], ['i30', /\bi ?30\b/], ['Azera', /\bazera\b/],
  ['Gol', /\bgol\b/], ['Voyage', /\bvoyage\b/], ['Polo', /\bpolo\b/], ['Virtus', /\bvirtus\b/],
  ['T-Cross', /\bt[ -]?cross\b/], ['Nivus', /\bnivus\b/], ['Taos', /\btaos\b/], ['Tiguan', /\btiguan\b/],
  ['Jetta', /\bjetta\b/], ['Saveiro', /\bsaveiro\b/], ['Amarok', /\bamarok\b/], ['Fox', /\bfox\b/],
  ['Up!', /\bup!|\bvw up\b|\bup tsi\b/], ['Golf', /\bgolf\b/], ['Fusca', /\bfusca\b/],
  ['Strada', /\bstrada\b/], ['Toro', /\btoro\b/], ['Argo', /\bargo\b/], ['Cronos', /\bcronos\b/],
  ['Mobi', /\bmobi\b/], ['Uno', /\buno\b/], ['Palio', /\bpalio\b/], ['Siena', /\bsiena\b/],
  ['Grand Siena', /\bgrand siena\b/], ['Fiorino', /\bfiorino\b/], ['Pulse', /\bpulse\b/],
  ['Fastback', /\bfastback\b/], ['Doblo', /\bdoblo\b/], ['Punto', /\bpunto\b/], ['Weekend', /\bweekend\b/],
  ['Renegade', /\brenegade\b/], ['Compass', /\bcompass\b/], ['Commander', /\bcommander\b/],
  ['Ka', /\bford ka\b|\bka sedan\b|\bka se\b|\bka \d{4}\b|\bo ka\b/], ['EcoSport', /\beco ?sport\b/],
  ['Fiesta', /\bfiesta\b/], ['Focus', /\bfocus\b/], ['Ranger', /\branger\b/], ['Fusion', /\bfusion\b/],
  ['Territory', /\bterritory\b/], ['Maverick', /\bmaverick\b/],
  ['Kwid', /\bkwid\b/], ['Sandero', /\bsandero\b/], ['Logan', /\blogan\b/], ['Duster', /\bduster\b/],
  ['Oroch', /\boroch\b/], ['Captur', /\bcaptur\b/], ['Stepway', /\bstepway\b/],
  ['Civic', /\bcivic\b/], ['City', /\bhonda city\b|\bcity (ex|exl|lx|touring|hatch|\d{4})\b/], ['Fit', /\bhonda fit\b|\bfit (ex|exl|lx|dx|\d{4})\b/],
  ['HR-V', /\bhr[ -]?v\b/], ['WR-V', /\bwr[ -]?v\b/], ['CR-V', /\bcr[ -]?v\b/],
  ['Kicks', /\bkicks\b/], ['Versa', /\bversa\b/], ['Sentra', /\bsentra\b/], ['March', /\bnissan march\b|\bmarch (s|sv|sl|\d{4})\b/],
  ['Frontier', /\bfrontier\b/], ['Peugeot 208', /\b(peugeot )?208\b/], ['Peugeot 2008', /\b(peugeot )?2008\b/],
  ['Peugeot 3008', /\b(peugeot )?3008\b/], ['C3', /\b(citroen )?c3\b/], ['C4 Cactus', /\bc4 cactus\b|\bcactus\b/],
  ['L200', /\bl ?200\b|\btriton\b/], ['Pajero', /\bpajero\b/], ['ASX', /\basx\b/], ['Outlander', /\boutlander\b/],
  ['Sportage', /\bsportage\b/], ['Cerato', /\bcerato\b/], ['Soul', /\bkia soul\b/], ['Picanto', /\bpicanto\b/],
  ['Tiggo', /\btiggo\b/], ['Arrizo', /\barrizo\b/], ['Song', /\bbyd song\b/], ['Dolphin', /\bdolphin\b/],
  ['Haval', /\bhaval\b/],
];

const MODELOS_PROMO_AMBIGUOS = new Set(['Classic', 'Weekend', 'Gol', 'Polo', 'Spin', 'Soul']);

function veiculosNoTexto(textoNormalizado) {
  const encontrados = new Set();
  for (const [nome, padrao] of VEICULOS) {
    if (!padrao.test(textoNormalizado)) continue;
    // "gol", "polo", "spin" etc. também são palavras comuns; exige contexto automotivo próximo.
    if (MODELOS_PROMO_AMBIGUOS.has(nome)) {
      const contexto = new RegExp(`\\b(${normalizar(nome)})\\b.{0,25}(\\b(19|20)\\d{2}\\b|\\b\\d\\.\\d\\b|\\bflex\\b|\\bmanual\\b|\\bautomatic|\\bcompleto\\b|\\bg\\d\\b|\\btrend\\b|\\bhighline\\b|\\bcomfortline\\b|\\bltz?\\b)|\\b(carro|veiculo|interesse|anuncio|o|no|do|esse|este)\\s+${normalizar(nome)}\\b`);
      if (!contexto.test(textoNormalizado)) continue;
    }
    encontrados.add(nome);
  }
  return encontrados;
}

const ehTroca = (texto) => SINAIS_QUENTE['carro na troca'].some((p) => p.test(texto));

function analisarConversa(conversa, mensagens, usuarios) {
  const humanas = mensagens.filter((m) => !String(m.messageType || '').startsWith('TYPE_ACTIVITY') && m.body);
  const doLead = humanas.filter((m) => m.direction === 'inbound');
  const daLoja = humanas.filter((m) => m.direction === 'outbound');
  const textoLead = doLead.map((m) => normalizar(m.body));
  const textoLoja = daLoja.map((m) => normalizar(m.body));

  // Lead que nunca respondeu a loja: só a mensagem de entrada (ex.: anúncio) ou nada.
  const primeiraSaida = daLoja[0];
  const respostasDoLead = primeiraSaida
    ? doLead.filter((m) => new Date(m.dateAdded) > new Date(primeiraSaida.dateAdded))
    : doLead.slice(1);

  const sinaisQuente = [];
  for (const [sinal, padroes] of Object.entries(SINAIS_QUENTE)) {
    if (textoLead.some((t) => padroes.some((p) => p.test(t)))) sinaisQuente.push(sinal);
  }
  // Visita confirmada pelo vendedor também conta ("fica agendado amanhã às 10h").
  const visitaConfirmada = /\b(agendad[oa]|confirmad[oa]|marcad[oa])\b.{0,40}\b(visita|amanha|hoje|as \d|\d ?h\b|test ?drive)\b/;
  if (!sinaisQuente.includes('agendou visita') && respostasDoLead.length > 0 && textoLoja.some((t) => visitaConfirmada.test(t))) {
    sinaisQuente.push('agendou visita');
  }
  if (mensagens.some((m) => String(m.messageType || '').includes('APPOINTMENT')) && !sinaisQuente.includes('agendou visita')) {
    sinaisQuente.push('agendou visita');
  }
  const sinaisMorno = textoLead.flatMap((t) => SINAIS_MORNO.filter((p) => p.test(t)).map(() => t)).slice(0, 3);

  let temperatura;
  let motivo;
  if (sinaisQuente.length > 0) {
    temperatura = 'quente';
    motivo = sinaisQuente.join(', ');
  } else if (doLead.length === 0 || (respostasDoLead.length === 0 && primeiraSaida)) {
    temperatura = 'frio';
    motivo = doLead.length === 0 ? 'lead não enviou nenhuma mensagem' : 'lead não respondeu após o primeiro contato da loja';
  } else {
    temperatura = 'morno';
    motivo = sinaisMorno.length > 0 ? `indeciso: "${sinaisMorno[0].slice(0, 80)}"` : 'respondeu, mas sem visita/troca/entrada/à vista';
  }

  // Veículos: procurados (mensagens do lead + primeira mensagem da loja) x oferecidos na troca.
  const procurados = new Set();
  const naTroca = new Set();
  for (const t of textoLead) {
    const encontrados = veiculosNoTexto(t);
    const destino = ehTroca(t) ? naTroca : procurados;
    for (const v of encontrados) destino.add(v);
  }
  if (procurados.size === 0) {
    for (const t of textoLoja.slice(0, 2)) for (const v of veiculosNoTexto(t)) procurados.add(v);
  }
  for (const v of procurados) naTroca.delete(v);

  // Atendimento do proprietário: primeira mensagem enviada pelo vendedor atribuído.
  const donoId = conversa.assignedTo || null;
  const inicio = new Date(doLead[0]?.dateAdded || conversa.dateAdded || mensagens[0]?.dateAdded || Date.now());
  const primeiraDoDono = donoId ? daLoja.find((m) => m.userId === donoId) : null;
  const primeiraHumana = daLoja.find((m) => m.userId);
  const minutos = (msg) => (msg ? Math.max(0, (new Date(msg.dateAdded) - inicio) / 60000) : null);

  return {
    conversationId: conversa.id,
    contactId: conversa.contactId,
    nome: conversa.fullName || conversa.contactName || conversa.contact?.name || '',
    telefone: conversa.phone || '',
    canal: conversa.lastMessageType || conversa.type || '',
    vendedorId: donoId,
    vendedor: donoId ? usuarios.get(donoId) || donoId : 'Sem vendedor atribuído',
    temperatura,
    motivo,
    msgsLead: doLead.length,
    msgsLoja: daLoja.length,
    inicioConversa: inicio.toISOString(),
    inicioAtendimentoDono: primeiraDoDono?.dateAdded || null,
    minutosAteDono: minutos(primeiraDoDono),
    primeiroAtendenteHumano: primeiraHumana ? usuarios.get(primeiraHumana.userId) || primeiraHumana.userId : null,
    minutosAtePrimeiroHumano: minutos(primeiraHumana),
    veiculosProcurados: [...procurados],
    veiculosNaTroca: [...naTroca],
  };
}

// ---------------------------------------------------------------------------
// Consolidação e saída
// ---------------------------------------------------------------------------

const formatarMinutos = (min) => {
  if (min === null || min === undefined) return '—';
  if (min < 1) return `${Math.round(min * 60)}s`;
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 1440) return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
  return `${(min / 1440).toFixed(1)} dias`;
};
const mediana = (valores) => {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
};
const csv = (linhas) => linhas.map((linha) => linha.map((valor) => {
  const texto = Array.isArray(valor) ? valor.join(' | ') : valor ?? '';
  return /[";\n]/.test(String(texto)) ? `"${String(texto).replace(/"/g, '""')}"` : String(texto);
}).join(';')).join('\n');

function consolidar(leads) {
  const totais = { total: leads.length, quente: 0, morno: 0, frio: 0 };
  const porVendedor = new Map();
  const procurados = new Map();
  const troca = new Map();
  for (const lead of leads) {
    totais[lead.temperatura] += 1;
    const v = porVendedor.get(lead.vendedor) || { vendedor: lead.vendedor, leads: 0, quente: 0, morno: 0, frio: 0, atendidos: 0, tempos: [] };
    v.leads += 1;
    v[lead.temperatura] += 1;
    if (lead.minutosAteDono !== null) { v.atendidos += 1; v.tempos.push(lead.minutosAteDono); }
    porVendedor.set(lead.vendedor, v);
    for (const veiculo of lead.veiculosProcurados) procurados.set(veiculo, (procurados.get(veiculo) || 0) + 1);
    for (const veiculo of lead.veiculosNaTroca) troca.set(veiculo, (troca.get(veiculo) || 0) + 1);
  }
  const vendedores = [...porVendedor.values()].map((v) => ({
    ...v,
    mediaMin: v.tempos.length ? v.tempos.reduce((a, b) => a + b, 0) / v.tempos.length : null,
    medianaMin: mediana(v.tempos),
    semAtendimento: v.leads - v.atendidos,
  })).sort((a, b) => b.leads - a.leads);
  const ranking = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1]).map(([veiculo, conversas]) => ({ veiculo, conversas }));
  return { totais, vendedores, topProcurados: ranking(procurados), topTroca: ranking(troca) };
}

function relatorioMarkdown(resumo, leads) {
  const pct = (n) => (resumo.totais.total ? `${((n / resumo.totais.total) * 100).toFixed(1)}%` : '0%');
  const l = [];
  l.push(`# Análise de conversas GHL — ${new Date().toLocaleString('pt-BR')}`, '');
  if (DESDE) l.push(`Período: conversas com atividade desde ${DESDE.toLocaleDateString('pt-BR')}`, '');
  l.push('## Temperatura dos leads', '', '| Métrica | Qtd | % |', '|---|---:|---:|');
  l.push(`| Total de leads (conversas) | ${resumo.totais.total} | 100% |`);
  for (const t of ['quente', 'morno', 'frio']) l.push(`| Leads ${t}s | ${resumo.totais[t]} | ${pct(resumo.totais[t])} |`);
  l.push('', '## Leads distribuídos e tempo de início do atendimento por vendedor (proprietário)', '');
  l.push('Tempo = da primeira mensagem do lead até a primeira mensagem enviada pelo vendedor atribuído na conversa.', '');
  l.push('| Vendedor | Leads | Quentes | Mornos | Frios | Atendidos pelo dono | Sem msg do dono | Tempo médio | Tempo mediano |');
  l.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const v of resumo.vendedores) {
    l.push(`| ${v.vendedor} | ${v.leads} | ${v.quente} | ${v.morno} | ${v.frio} | ${v.atendidos} | ${v.semAtendimento} | ${formatarMinutos(v.mediaMin)} | ${formatarMinutos(v.medianaMin)} |`);
  }
  l.push('', '## Top veículos mais procurados nas conversas', '', '| # | Veículo | Conversas |', '|---:|---|---:|');
  resumo.topProcurados.slice(0, 20).forEach((r, i) => l.push(`| ${i + 1} | ${r.veiculo} | ${r.conversas} |`));
  if (resumo.topTroca.length) {
    l.push('', '## Veículos oferecidos na troca', '', '| Veículo | Conversas |', '|---|---:|');
    resumo.topTroca.slice(0, 10).forEach((r) => l.push(`| ${r.veiculo} | ${r.conversas} |`));
  }
  l.push('', '## Leads quentes para negociação', '', '| Lead | Telefone | Vendedor | Veículo | Sinais | Atendimento do dono |', '|---|---|---|---|---|---|');
  for (const lead of leads.filter((x) => x.temperatura === 'quente')) {
    l.push(`| ${lead.nome || lead.contactId} | ${lead.telefone} | ${lead.vendedor} | ${lead.veiculosProcurados.join(', ') || '—'} | ${lead.motivo} | ${formatarMinutos(lead.minutosAteDono)} |`);
  }
  l.push('', '_Classificação automática por palavras-chave no texto das conversas; revise os casos limítrofes no CSV._');
  return l.join('\n');
}

// ---------------------------------------------------------------------------

const usuarios = await listarUsuarios();
let conversas = await listarConversas();
if (DESDE) conversas = conversas.filter((c) => Number(c.lastMessageDate || c.dateUpdated || 0) >= DESDE.getTime() || new Date(c.dateUpdated || 0) >= DESDE);

const leads = [];
for (const [index, conversa] of conversas.entries()) {
  process.stdout.write(`\rAnalisando conversas: ${index + 1}/${conversas.length}`);
  try {
    leads.push(analisarConversa(conversa, await listarMensagens(conversa.id), usuarios));
  } catch (error) {
    console.warn(`\nAviso: conversa ${conversa.id} ignorada (${error.message})`);
  }
}
process.stdout.write('\n');

const resumo = consolidar(leads);
await mkdir(SAIDA, { recursive: true });
const cabecalho = ['conversationId', 'contactId', 'nome', 'telefone', 'canal', 'vendedor', 'temperatura', 'motivo', 'msgsLead', 'msgsLoja',
  'inicioConversa', 'inicioAtendimentoDono', 'tempoAteDono', 'primeiroAtendenteHumano', 'tempoAtePrimeiroHumano', 'veiculosProcurados', 'veiculosNaTroca'];
await writeFile(path.join(SAIDA, 'leads.csv'), `﻿${csv([cabecalho, ...leads.map((x) => [
  x.conversationId, x.contactId, x.nome, x.telefone, x.canal, x.vendedor, x.temperatura, x.motivo, x.msgsLead, x.msgsLoja,
  x.inicioConversa, x.inicioAtendimentoDono, formatarMinutos(x.minutosAteDono), x.primeiroAtendenteHumano,
  formatarMinutos(x.minutosAtePrimeiroHumano), x.veiculosProcurados, x.veiculosNaTroca,
])])}`);
await writeFile(path.join(SAIDA, 'resumo.json'), JSON.stringify({ geradoEm: new Date().toISOString(), ...resumo, leads }, null, 2));
const markdown = relatorioMarkdown(resumo, leads);
await writeFile(path.join(SAIDA, 'relatorio.md'), markdown);

console.log(`\n${markdown.split('\n## Leads quentes')[0]}`);
console.log(`\nArquivos gerados em ${SAIDA}/: relatorio.md, leads.csv, resumo.json`);
