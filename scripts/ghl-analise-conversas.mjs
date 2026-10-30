// Analisa todas as conversas de uma location do GoHighLevel (GHL) e gera:
// - classificação de cada lead (quente / morno / frio) com base no texto das conversas;
// - tempo até o vendedor atribuído (proprietário) iniciar o atendimento na conversa;
// - totais por temperatura, leads distribuídos por vendedor e veículos mais procurados.
//
// Uso:
//   GHL_TOKEN=pit-... GHL_LOCATION_ID=... node scripts/ghl-analise-conversas.mjs [--desde=AAAA-MM-DD] [--saida=relatorios-ghl] [--cache=arquivo.json]
// As variáveis também podem ficar em .env.local. Requer Node 20.12+ e nenhuma dependência.
// --cache salva as conversas baixadas e, se o arquivo já existir, reaproveita sem chamar a API.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const CACHE = typeof args.cache === 'string' ? args.cache : null;
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
    return (await ghl('/users/', { locationId: LOCATION_ID }, '2021-07-28')).users || [];
  } catch (error) {
    console.warn(`Aviso: não foi possível listar usuários (${error.message}). Vendedores aparecerão pelo ID.`);
    return [];
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
  return mensagens;
}

async function carregarDados() {
  if (CACHE) {
    try {
      const dados = JSON.parse(await readFile(CACHE, 'utf8'));
      console.log(`Usando dados salvos em ${CACHE} (${dados.conversas.length} conversas).`);
      return dados;
    } catch {
      // Sem cache válido: baixa da API e salva abaixo.
    }
  }
  if (!TOKEN || !LOCATION_ID) throw new Error('Defina GHL_TOKEN e GHL_LOCATION_ID (ambiente ou .env.local).');
  const usuarios = await listarUsuarios();
  const conversas = await listarConversas();
  const mensagens = {};
  for (const [index, conversa] of conversas.entries()) {
    process.stdout.write(`\rBaixando mensagens: ${index + 1}/${conversas.length}`);
    try {
      mensagens[conversa.id] = await listarMensagens(conversa.id);
    } catch (error) {
      console.warn(`\nAviso: conversa ${conversa.id} ignorada (${error.message})`);
    }
  }
  process.stdout.write('\n');
  const dados = { baixadoEm: new Date().toISOString(), usuarios, conversas, mensagens };
  if (CACHE) await writeFile(CACHE, JSON.stringify(dados));
  return dados;
}

// ---------------------------------------------------------------------------
// Análise de texto
// ---------------------------------------------------------------------------

const normalizar = (texto) => String(texto || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// Remove o rodapé do integrador de WhatsApp e separa respostas citadas:
// '↩️ Reply message: "pergunta" ➡️ Message: "resposta"' -> { texto: resposta, citado: pergunta }.
function limparCorpo(body) {
  const semRodape = String(body || '').replace(/Instance Source:.*$/is, '');
  const resposta = semRodape.match(/Reply message:\s*"([\s\S]*?)"\s*➡️\s*Message:\s*"([\s\S]*)"/);
  return resposta
    ? { texto: normalizar(resposta[2]), citado: normalizar(resposta[1]) }
    : { texto: normalizar(semRodape), citado: '' };
}

const RE_MIDIA = /^(ptt|audio|image|video|motion_video|document|media|sticker|album: .*|\[?(imagem|audio|video)\]?)$/;
const RE_SO_SAUDACAO = /^(oi+e?|ola+|opa|eae|e ai|bom dia|boa tarde|boa noite|tudo bem|tudo bom|td bem|blz|beleza|ok|okay|sim|nao|obrigad[oa]|valeu|vlw|👍|🙏|😊|\?|\.)([ ,!.?]+(oi+e?|ola+|bom dia|boa tarde|boa noite|tudo bem|tudo bom|td bem|blz|ok|obrigad[oa]|valeu|👍))*[ ,!.?]*$/;
const RE_AUTORRESPOSTA = /(nao estou disponivel|responderei assim que|mensagem automatica|horario de atendimento|como foi sua experiencia|informa pra mim o numero do seu)/;

const RE_TRANSFERENCIA = /(transferindo|transferir voce|vou te conectar com um|encaminhar .{0,60}consultor|passar .{0,60}(para|pro) (o )?(nosso )?consultor|consultor.{0,40}(dara|vai dar|ira dar) (seguimento|continuidade))/;
const RE_ALERTA_INTERNO = /atribuido para voce/;

// Sinais de lead quente no texto do próprio lead.
const SINAIS_QUENTE = {
  'agendou/quer visitar a loja': [
    /\b(agend(ar|ei|ado|ada|amos|ou)|marc(ar|ei|ado|ada|amos|ou))\b.{0,40}\b(visita|horario|test ?drive|ai na loja|na loja|amanha|hoje|sabado|domingo|segunda|terca|quarta|quinta|sexta)\b/,
    /\b(ir|passar|passo|chegar|chego|aparecer|apareco|dar um pulo|dar uma passada|visitar|conhecer)\b.{0,15}\b(ai|ate ai|na loja|ate a loja|a loja|ai na loja|pessoalmente)\b/,
    /\b(consigo|posso|vou|vamos|irei|iremos) (ir|passar|aparecer)\b/,
    /\b(qual|qual o|me passa o|manda o|me manda o|passa o) (endereco|localizacao)\b|\bendereco da loja\b|\bmanda a localizacao\b/,
    /\b(test ?drive)\b/,
    /\b(fomos|fui|estive|estivemos|passei|passamos)\b(?!.{0,12}\b(na|em) frente)\b.{0,20}\b(na loja|ai na loja|ai|na topmais|no patio)\b/,
  ],
  'carro na troca': [
    /\b(na troca|pra troca|para troca|de troca|dar na troca|aceita(m)? troca|pega(m)? troca|trocar (o|meu|minha)|troca no meu|troca na minha|pegar meu carro|avaliar meu|avaliacao do meu|meu carro na|minha moto na)\b/,
    /\btenho (um|uma)\b.{0,40}\b(pra|para) (dar|trocar|troca|entrada)\b/,
    /\b(tenho|dou) (um )?(veiculo|carro|moto)\b.{0,30}\b(entrada|troca)\b/,
    /\b(fazer (a |uma )?troca|trocar (dois|duas|\d) |avaliacao previa|avaliar (o )?meu|avaliacao (do|da) meu)\b/,
    /\b(eu tenho|tenho um|tenho uma|meu carro e|o meu e|a minha e)\b.{0,30}\b(ano )?(19[89]\d|20[0-2]\d)\b/,
  ],
  'valor de entrada': [
    /\bentrada\b.{0,30}(\d|\bmil\b|\breais\b|r\$)/,
    /(\d|\bmil\b|r\$|\bk\b).{0,25}\bde entrada\b/,
    /\b(tenho|dou|daria|consigo dar|posso dar)\b.{0,40}\b(valor|dinheiro|grana)?.{0,10}\bentrada\b/,
  ],
  'pagamento à vista': [
    /\ba vista\b/,
    /\b(no|via|em|pagamento|pagar|pago|tudo)\s+(no\s+)?pix\b/,
    /\bdinheiro na mao\b/,
  ],
};

// Pergunta da loja logo antes da resposta do lead (contexto).
const CONTEXTO_TROCA = /\b(troca|veiculo (de|na|como|para|pra) entrada|carro (de|na|como|para|pra) entrada|seu (carro|veiculo)|avaliar|avaliacao|usado na negociacao)\b/;
const CONTEXTO_ENTRADA = /\b(entrada|ideia de negocio|quanto (voce )?(pretende|consegue|pode) dar)\b/;
const CONTEXTO_VISITA = /\b(vir ate a loja|vir na loja|vir aqui|passar aqui|visita|agendar|agendamento|test ?drive|que horas|qual horario|quando (voce )?(consegue|pode) vir)\b/;
const RE_VALOR = /(\d+ ?(mil|k)\b|r\$ ?\d|\b\d{1,3}\.\d{3}\b|\b\d{4,6}\b(?! ?km)|\b\d{1,2} ?%)/;
const RE_ANO = /\b(19[89]\d|20[0-2]\d)\b/;
const RE_NEGACAO = /^(nao|n|nenhum|nenhuma|sem)\b/;
const RE_DIA_HORA = /\b(amanha|hoje|sabado|domingo|segunda|terca|quarta|quinta|sexta|as \d|\d{1,2} ?h\b|\d{1,2}:\d{2})\b/;
const RE_VISITA_CONFIRMADA = /\b(agendad[oa]|confirmad[oa]|marcad[oa])\b.{0,40}\b(visita|amanha|hoje|as \d|\d ?h\b|test ?drive|sabado|segunda|terca|quarta|quinta|sexta)\b|\b(te espero|te aguardo|aguardo voce|esperamos voce)\b.{0,30}\b(amanha|hoje|as \d|\d ?h\b|sabado|segunda|terca|quarta|quinta|sexta|aqui|na loja)\b/;

const RE_SEM_INTERESSE = /\b(nao tenho (mais )?interesse|perdi o interesse|sem interesse|ja comprei|ja fechei|ja adquiri|nao quero mais|desisti|pode (me )?remover|numero errado|nao sou (o|a)?\s?\w+ ?$)/;
// Vocabulário de negociação de veículo (sem nome de modelo) escrito pelo lead ou pelo vendedor.
const RE_ASSUNTO_VEICULO = /\b(carro|veiculo|moto|financ\w*|parcela\w*|entrada|troca|km|quilometragem|simulac\w*|test ?drive|cambio|automatico|seminovo|webmotors|chaves na mao|icarros|top ?\+? ?car|topmais|placa|laudo|ipva|revisao|consultor de vendas|anuncio|vir (na|ate a) loja|(contato|numero) da loja|jeep|toyota|fiat|chevrolet|volkswagen|hyundai|renault|nissan|citroen|peugeot|honda|mitsubishi)\b/;
// Mensagens automáticas que só existem no fluxo de atendimento de leads de veículo.
const RE_FLUXO_DE_LEAD = /(escolher seu carro|ainda tem interesse em negociar|transferindo para um|nossos consultores)/;
const MARCAS = /^(fiat|citroen|chevrolet|gm|volkswagen|vw|ford|renault|toyota|honda|hyundai|nissan|jeep|peugeot|mitsubishi|kia|caoa|chery|byd|audi|bmw|mercedes|land|volvo|suzuki|jac|ram|dodge)\b/;

const SINAIS_MORNO = [
  /\b(vou|preciso|vamos|deixa eu|deixe eu|tenho que|quero) (pensar|analisar|avaliar|ver direitinho|decidir|refletir|pesquisar)\b/,
  /\b(ver|conversar|falar|consultar|decidir|olhar)\b.{0,15}\b(com )?(a |o |minha |meu )?(esposa|marido|mulher|namorad[ao]|noiv[ao]|familia|pai|mae|filh[ao]|irma[o]?|socio|sogr[ao])\b/,
  /\b(depois (te|eu|a gente) (falo|aviso|retorno|chamo|vejo)|te (retorno|aviso|dou um retorno|chamo depois)|qualquer coisa (te )?(chamo|falo|aviso)|mais pra frente|mais para frente|ainda nao (sei|decidi)|(to|estou|fiquei) (indecis|em duvida|pensando)|vou dar uma olhada|so pesquisando|so olhando|estou pesquisando|so (uma )?cotacao|no momento nao|por enquanto nao|agora nao)\b/,
  /\b(achei caro|ta caro|esta caro|muito caro|fora do (meu )?orcamento|vou juntar|nao tenho (entrada|dinheiro))\b/,
];

// Modelos mais comuns no varejo de usados no Brasil (nome exibido -> padrão de busca).
const VEICULOS = [
  ['Corolla Cross', /\bcorolla cross\b/], ['Corolla', /\bcorolla\b(?! cross)/], ['Hilux SW4', /\b(sw4|sw 4)\b/],
  ['Hilux', /\bhilux\b(?! sw)/], ['Yaris', /\byaris\b/], ['Etios', /\betios\b/], ['RAV4', /\brav ?4\b/],
  ['Onix Plus', /\bonix plus\b/], ['Onix', /\bonix\b(?! plus)/], ['Prisma', /\bprisma\b/], ['Cruze', /\bcruze\b/],
  ['Tracker', /\btracker\b/], ['S10', /\bs ?10\b/], ['Spin', /\bspin\b/], ['Montana', /\bmontana\b/],
  ['Cobalt', /\bcobalt\b/], ['Celta', /\bcelta\b/], ['Corsa', /\bcorsa\b/], ['Equinox', /\bequinox\b/],
  ['Trailblazer', /\btrailblazer\b/], ['Agile', /\bagile\b/], ['Astra', /\bastra\b/], ['Vectra', /\bvectra\b/],
  ['HB20S', /\bhb ?20 ?s\b/], ['HB20', /\bhb ?20\b(?! ?s\b)/], ['Creta', /\bcreta\b/], ['Tucson', /\btucson\b/],
  ['ix35', /\bix ?35\b/], ['Santa Fe', /\bsanta fe\b/], ['i30', /\bi30\b/], ['Azera', /\bazera\b/],
  ['Gol', /\bgol\b/], ['Voyage', /\bvoyage\b/], ['Polo', /\bpolo\b/], ['Virtus', /\bvirtus\b/],
  ['T-Cross', /\bt[ -]?cross\b/], ['Nivus', /\bnivus\b/], ['Taos', /\btaos\b/], ['Tiguan', /\btiguan\b/],
  ['Jetta', /\bjetta\b/], ['Saveiro', /\bsaveiro\b/], ['Amarok', /\bamarok\b/], ['Fox', /\bfox\b/],
  ['CrossFox', /\bcross ?fox\b/], ['SpaceFox', /\bspace ?fox\b/], ['Up!', /\bvw up\b|\bup tsi\b|\bup!/],
  ['Golf', /\bgolf\b/], ['Fusca', /\bfusca\b/], ['Passat', /\bpassat\b/],
  ['Strada', /\bstrada\b/], ['Toro', /\btoro\b/], ['Argo', /\bargo\b/], ['Cronos', /\bcronos\b/],
  ['Mobi', /\bmobi\b/], ['Uno', /\buno\b/], ['Palio', /\bpalio\b/], ['Grand Siena', /\bgrand siena\b/],
  ['Siena', /\bsiena\b/], ['Fiorino', /\bfiorino\b/], ['Pulse', /\bpulse\b/], ['Fastback', /\bfastback\b/],
  ['Doblo', /\bdoblo\b/], ['Punto', /\bpunto\b/], ['Idea', /\bfiat idea\b|\bidea (attractive|essence|adventure|elx|\d\.\d)\b/],
  ['Grand Cherokee', /\bgrand cherokee\b/], ['Renegade', /\brenegade\b/], ['Compass', /\bcompass\b/], ['Commander', /\bcommander\b/],
  ['Ka', /\bford ka\b|\bka (sedan|se|s|sel|plus|\d\.\d)\b|\bka (19|20)\d{2}\b/], ['EcoSport', /\beco ?sport\b/],
  ['Fiesta', /\bfiesta\b/], ['Focus', /\bfocus\b/], ['Ranger', /\branger\b/], ['Fusion', /\bfusion\b/],
  ['Territory', /\bterritory\b/], ['Maverick', /\bmaverick\b/], ['Escort', /\bescort\b/],
  ['Kwid', /\bkwid\b/], ['Sandero', /\bsandero\b/], ['Logan', /\blogan\b/], ['Duster', /\bduster\b/],
  ['Oroch', /\boroch\b/], ['Captur', /\bcaptur\b/], ['Stepway', /\bstepway\b/], ['Fluence', /\bfluence\b/],
  ['Civic', /\bcivic\b/], ['City', /\bhonda city\b|\bcity (ex|exl|lx|touring|hatch|(19|20)\d{2})\b/],
  ['Fit', /\bhonda fit\b|\bfit (ex|exl|lx|dx|ex\/l|(19|20)\d{2}|\d\.\d)\b/],
  ['HR-V', /\bhr[ -]?v\b/], ['WR-V', /\bwr[ -]?v\b/], ['CR-V', /\bcr[ -]?v\b/],
  ['Kicks', /\bkicks\b/], ['Versa', /\bversa\b/], ['Sentra', /\bsentra\b/], ['March', /\bnissan march\b|\bmarch (s|sv|sl|(19|20)\d{2}|\d\.\d)\b/],
  ['Frontier', /\bfrontier\b/], ['Livina', /\blivina\b/], ['Peugeot 208', /\b(peugeot )?208\b/], ['Peugeot 2008', /\b(peugeot )?2008\b(?! (km|mil))/],
  ['Peugeot 3008', /\b(peugeot )?3008\b/], ['Peugeot 308', /\b(peugeot )?308\b/], ['C3', /\bc3\b/],
  ['C4 Cactus', /\bc4 cactus\b|\bcactus\b/], ['C4 Picasso', /\bc4 (grand )?picasso\b/], ['Freemont', /\bfreemont\b/], ['C4 Lounge', /\bc4 ?l(ounge)?\b/], ['Aircross', /\baircross\b/],
  ['L200', /\bl ?200\b|\btriton\b/], ['Pajero', /\bpajero\b/], ['ASX', /\basx\b/], ['Outlander', /\boutlander\b/],
  ['Lancer', /\blancer\b/], ['Eclipse Cross', /\beclipse cross\b/],
  ['Sportage', /\bsportage\b/], ['Cerato', /\bcerato\b/], ['Soul', /\bkia soul\b/], ['Picanto', /\bpicanto\b/],
  ['Tiggo', /\btiggo\b/], ['Arrizo', /\barrizo\b/], ['BYD Song', /\bbyd song\b|\bsong plus\b/], ['BYD Dolphin', /\bdolphin\b/],
  ['Haval', /\bhaval\b/], ['Discovery', /\bdiscovery\b/], ['Evoque', /\bevoque\b/], ['Audi A3', /\baudi a3\b|\ba3 (sedan|sportback)\b/],
  ['BMW 320i', /\b320i\b/], ['Mercedes Classe C', /\bc ?180\b|\bc ?200\b|\bclasse c\b/],
];

// Palavras comuns que também são modelos: só contam com contexto automotivo por perto.
const MODELOS_AMBIGUOS = new Set(['Gol', 'Polo', 'Spin', 'Fox', 'Fit', 'Up!', 'Uno', 'Idea', 'Pulse', 'Toro', 'Versa', 'Discovery']);
const RE_CONTEXTO_AUTO = /\b(19[89]\d|20[0-2]\d)\b|\b\d\.\d\b|\b(flex|manual|automatic[oa]|aut|completo|turbo|tsi|trend|highline|comfortline|confortline|track|attractive|sense|drive|volcano|ranch|freedom|endurance|ultra|km|hatch|sedan|cross|g[4-8])\b/;

function veiculosNoTexto(texto) {
  const encontrados = new Set();
  for (const [nome, padrao] of VEICULOS) {
    const match = texto.match(padrao);
    if (!match) continue;
    if (MODELOS_AMBIGUOS.has(nome)) {
      const janela = texto.slice(Math.max(0, match.index - 25), match.index + match[0].length + 30);
      const marca = /\b(vw|volks|volkswagen|fiat|honda|nissan|jeep|chevrolet|gm|land rover)\b/.test(janela);
      if (!marca && !RE_CONTEXTO_AUTO.test(janela.replace(match[0], ''))) continue;
    }
    encontrados.add(nome);
  }
  if (encontrados.has('CrossFox') || encontrados.has('SpaceFox')) encontrados.delete('Fox');
  if (encontrados.has('Grand Siena')) encontrados.delete('Siena');
  return encontrados;
}

const RE_INTERESSE_ANUNCIO = /(se interessou|interesse (no|na|em)|voce viu|que voce viu|simulando financiamento|veiculo que|anuncio)/;

// Abertura da assistente com o título do anúncio fora da lista ("...no nosso FIAT FREEMONT 2.4 ...").
function veiculoDoTituloDoAnuncio(texto) {
  const titulo = texto.match(/se interessou no nosso ([a-z0-9 .-]{3,60})/)?.[1];
  if (!titulo || /^qual\b/.test(titulo)) return null;
  const palavras = titulo.split(' ').filter(Boolean);
  const nome = MARCAS.test(titulo) ? palavras.slice(0, 2) : palavras.slice(0, 1);
  return nome.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function tipoDeMensagem(m) {
  const tipo = String(m.messageType || '');
  if (tipo.startsWith('TYPE_ACTIVITY')) return 'atividade';
  if (tipo === 'TYPE_INTERNAL_COMMENT') return 'nota';
  if (m.direction === 'inbound') return 'lead';
  if (m.userId && m.source !== 'workflow') return 'vendedor';
  return 'automacao'; // assistente virtual, workflows e mensagens sem usuário do GHL
}

function analisarConversa(conversa, mensagensBrutas, nomes) {
  const mensagens = mensagensBrutas
    .map((m) => ({ ...m, quem: tipoDeMensagem(m), ...limparCorpo(m.body), data: new Date(m.dateAdded) }))
    .filter((m) => m.quem !== 'atividade')
    .sort((a, b) => a.data - b.data);
  const doLead = mensagens.filter((m) => m.quem === 'lead');
  const daLoja = mensagens.filter((m) => m.quem === 'vendedor' || m.quem === 'automacao');
  const notas = mensagens.filter((m) => m.quem === 'nota');

  const sinais = new Set();
  const morno = [];
  const procurados = new Set();
  const naTroca = new Set();
  let ultimaDaLoja = '';
  let respostasReais = 0;
  let semInteresse = null;
  let falaDeVeiculo = mensagens.some((m) => ((m.quem === 'vendedor' || m.quem === 'nota') && RE_ASSUNTO_VEICULO.test(m.texto))
    || (m.quem === 'automacao' && RE_FLUXO_DE_LEAD.test(m.texto)));

  for (const m of mensagens) {
    if (m.quem === 'nota') continue;
    if (m.quem !== 'lead') {
      if (m.texto) ultimaDaLoja = m.texto;
      continue;
    }
    const t = m.texto;
    if (!t || RE_AUTORRESPOSTA.test(t) || t === 'sticker') continue;
    if (!RE_SO_SAUDACAO.test(t)) respostasReais += 1;
    if (RE_MIDIA.test(t)) continue;

    const contexto = m.citado || ultimaDaLoja;
    const veiculos = veiculosNoTexto(t);
    if (veiculos.size > 0 || RE_ASSUNTO_VEICULO.test(t)) falaDeVeiculo = true;
    if (!semInteresse && RE_SEM_INTERESSE.test(t)) semInteresse = t.slice(0, 90);
    for (const [sinal, padroes] of Object.entries(SINAIS_QUENTE)) {
      if (padroes.some((p) => p.test(t))) sinais.add(sinal);
    }
    const negou = RE_NEGACAO.test(t);
    const respondeTroca = !negou && CONTEXTO_TROCA.test(contexto)
      && (veiculos.size > 0 || RE_ANO.test(t) || /^(sim|tenho|tenho sim|sim tenho|tenho um|tenho uma)\b/.test(t));
    const ehTroca = respondeTroca || SINAIS_QUENTE['carro na troca'].some((p) => p.test(t));
    if (respondeTroca) sinais.add('carro na troca');
    if (!negou && CONTEXTO_ENTRADA.test(contexto) && RE_VALOR.test(t) && !RE_ANO.test(t)) {
      sinais.add(/\b(pix|a vista)\b/.test(t) ? 'pagamento à vista' : 'valor de entrada');
    }
    if (!negou && CONTEXTO_VISITA.test(contexto) && RE_DIA_HORA.test(t)) sinais.add('agendou/quer visitar a loja');
    for (const p of SINAIS_MORNO) if (p.test(t) && morno.length < 2) morno.push(t.slice(0, 90));
    for (const v of veiculos) (ehTroca ? naTroca : procurados).add(v);
  }

  // Visita confirmada pela loja depois de o lead ter respondido.
  if (respostasReais > 0 && daLoja.some((m) => m.quem === 'vendedor' && RE_VISITA_CONFIRMADA.test(m.texto))) {
    sinais.add('agendou/quer visitar a loja');
  }

  // Notas internas do vendedor ("cliente veio na loja, procura sedan ou 2008").
  for (const nota of notas) {
    if (/\b(veio|esteve|visitou|passou)\b.{0,15}\b(loja|patio)\b/.test(nota.texto)) sinais.add('agendou/quer visitar a loja');
    for (const v of veiculosNoTexto(nota.texto)) procurados.add(v);
  }

  // Veículo do anúncio citado pela assistente virtual na abertura da conversa.
  const abertura = daLoja.find((m) => m.quem === 'automacao' && RE_INTERESSE_ANUNCIO.test(m.texto) && veiculosNoTexto(m.texto).size > 0);
  if (abertura) for (const v of veiculosNoTexto(abertura.texto)) procurados.add(v);
  if (procurados.size === 0) {
    const titulo = daLoja.map((m) => m.quem === 'automacao' && veiculoDoTituloDoAnuncio(m.texto)).find(Boolean);
    if (titulo) procurados.add(titulo);
  }
  const aberturaSemVeiculo = daLoja.some((m) => m.quem === 'automacao' && /se interessou no nosso qual\b/.test(m.texto));
  if (procurados.size === 0) {
    const primeiraDoVendedor = daLoja.find((m) => m.quem === 'vendedor' && veiculosNoTexto(m.texto).size > 0);
    if (primeiraDoVendedor) for (const v of veiculosNoTexto(primeiraDoVendedor.texto)) procurados.add(v);
  }
  for (const v of procurados) naTroca.delete(v);

  let temperatura;
  let motivo;
  const sinalDeNegociacao = ['agendou/quer visitar a loja', 'carro na troca', 'valor de entrada'].some((x) => sinais.has(x));
  if (procurados.size === 0 && naTroca.size === 0 && !sinalDeNegociacao && !falaDeVeiculo && !aberturaSemVeiculo) {
    temperatura = 'fora';
    motivo = mensagens.some((m) => m.texto) ? 'contato sem assunto de veículo (pessoal, fornecedor, propaganda etc.)' : 'conversa sem nenhuma mensagem';
  } else if (sinais.size > 0) {
    temperatura = 'quente';
    motivo = [...sinais].join(', ');
  } else if (semInteresse) {
    temperatura = 'frio';
    motivo = `sem interesse: "${semInteresse}"`;
  } else if (respostasReais === 0) {
    temperatura = 'frio';
    motivo = doLead.length === 0 ? 'lead não enviou nenhuma mensagem' : 'lead não respondeu (só saudação/figurinha)';
  } else {
    temperatura = 'morno';
    motivo = morno.length > 0 ? `indeciso: "${morno[0]}"` : 'conversou, mas sem visita/troca/entrada/à vista';
  }

  // Atendimento do proprietário: primeira mensagem escrita pelo vendedor atribuído (exclui automações).
  const donoId = conversa.assignedTo || null;
  const primeiraDoDono = donoId ? daLoja.find((m) => m.quem === 'vendedor' && m.userId === donoId) : null;
  const transferencia = daLoja.find((m) => m.quem === 'automacao' && RE_TRANSFERENCIA.test(m.texto));
  const primeiraDoLead = doLead[0];
  let referencia = null;
  let base = '';
  if (primeiraDoDono) {
    if (transferencia && transferencia.data <= primeiraDoDono.data) {
      referencia = transferencia; base = 'transferência da assistente';
    } else if (primeiraDoLead && primeiraDoLead.data <= primeiraDoDono.data) {
      referencia = primeiraDoLead; base = '1ª mensagem do lead';
    } else {
      base = 'vendedor iniciou a conversa';
    }
  }

  return {
    conversationId: conversa.id,
    contactId: conversa.contactId,
    nome: conversa.fullName || conversa.contactName || '',
    telefone: conversa.phone || '',
    vendedorId: donoId,
    vendedor: donoId ? nomes.get(donoId) || donoId : 'Sem vendedor atribuído',
    temperatura,
    motivo,
    msgsLead: doLead.length,
    msgsVendedores: daLoja.filter((m) => m.quem === 'vendedor').length,
    msgsAutomacao: daLoja.filter((m) => m.quem === 'automacao').length,
    inicioConversa: mensagens[0]?.data.toISOString() || null,
    inicioAtendimentoDono: primeiraDoDono?.data.toISOString() || null,
    baseDoTempo: base,
    minutosAteDono: referencia ? (primeiraDoDono.data - referencia.data) / 60000 : null,
    veiculosProcurados: [...procurados],
    veiculosNaTroca: [...naTroca],
    aberturaSemVeiculo,
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
  return `${(min / 1440).toFixed(1).replace('.', ',')} dias`;
};
const mediana = (valores) => {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
};
const percentual = (parte, total) => (total ? `${Math.round((parte / total) * 100)}%` : '—');
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
    const v = porVendedor.get(lead.vendedor)
      || { vendedor: lead.vendedor, leads: 0, quente: 0, morno: 0, frio: 0, atendidos: 0, iniciouConversa: 0, tempos: [] };
    v.leads += 1;
    v[lead.temperatura] += 1;
    if (lead.inicioAtendimentoDono) v.atendidos += 1;
    if (lead.baseDoTempo === 'vendedor iniciou a conversa') v.iniciouConversa += 1;
    if (lead.minutosAteDono !== null) v.tempos.push(lead.minutosAteDono);
    porVendedor.set(lead.vendedor, v);
    for (const veiculo of lead.veiculosProcurados) procurados.set(veiculo, (procurados.get(veiculo) || 0) + 1);
    for (const veiculo of lead.veiculosNaTroca) troca.set(veiculo, (troca.get(veiculo) || 0) + 1);
  }
  const vendedores = [...porVendedor.values()].map((v) => ({
    ...v,
    semAtendimento: v.leads - v.atendidos,
    medianaMin: mediana(v.tempos),
    ate15min: v.tempos.filter((x) => x <= 15).length,
    ate1h: v.tempos.filter((x) => x <= 60).length,
    mais24h: v.tempos.filter((x) => x > 1440).length,
  })).sort((a, b) => (a.vendedor === 'Sem vendedor atribuído') - (b.vendedor === 'Sem vendedor atribuído') || b.leads - a.leads);
  const ranking = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1]).map(([veiculo, conversas]) => ({ veiculo, conversas }));
  return {
    totais,
    vendedores,
    topProcurados: ranking(procurados),
    topTroca: ranking(troca),
    semVeiculo: leads.filter((x) => x.veiculosProcurados.length === 0).length,
    aberturaSemVeiculo: leads.filter((x) => x.veiculosProcurados.length === 0 && x.aberturaSemVeiculo).length,
  };
}

function relatorioMarkdown(resumo, leads, internas, fora) {
  const { totais } = resumo;
  const l = [];
  l.push(`# Análise de conversas GHL — ${new Date().toLocaleString('pt-BR')}`, '');
  if (DESDE) l.push(`Período: conversas com atividade desde ${DESDE.toLocaleDateString('pt-BR')}`, '');
  const vazias = fora.filter((x) => x.motivo === 'conversa sem nenhuma mensagem').length;
  l.push(`${totais.total} leads analisados. Ficaram de fora ${internas} conversas internas da equipe, ${fora.length - vazias} contatos sem assunto de veículo (pessoais, fornecedores, propaganda) e ${vazias} conversas sem nenhuma mensagem — listados em fora-do-escopo.csv.`, '');
  l.push('## Temperatura dos leads', '', '| Métrica | Qtd | % |', '|---|---:|---:|');
  l.push(`| Total de leads | ${totais.total} | 100% |`);
  for (const t of ['quente', 'morno', 'frio']) l.push(`| Leads ${t}s | ${totais[t]} | ${percentual(totais[t], totais.total)} |`);
  l.push('', '## Leads distribuídos por vendedor', '', '| Vendedor | Leads | Quentes | Mornos | Frios |', '|---|---:|---:|---:|---:|');
  for (const v of resumo.vendedores) l.push(`| ${v.vendedor} | ${v.leads} | ${v.quente} | ${v.morno} | ${v.frio} |`);
  l.push('', '## Tempo até o vendedor (proprietário) iniciar o atendimento', '');
  l.push('Medido da transferência feita pela assistente virtual (ou da 1ª mensagem do lead, quando não houve transferência) até a 1ª mensagem escrita pelo vendedor atribuído. Follow-ups automáticos não contam.', '');
  l.push('| Vendedor | Leads | Com msg do dono | Sem msg do dono | Vendedor puxou a conversa | Tempo mediano | Até 15 min | Até 1h | Mais de 24h |');
  l.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const v of resumo.vendedores.filter((x) => x.vendedor !== 'Sem vendedor atribuído')) {
    const n = v.tempos.length;
    l.push(`| ${v.vendedor} | ${v.leads} | ${v.atendidos} | ${v.semAtendimento} | ${v.iniciouConversa} | ${formatarMinutos(v.medianaMin)} | ${percentual(v.ate15min, n)} | ${percentual(v.ate1h, n)} | ${percentual(v.mais24h, n)} |`);
  }
  l.push('', '## Top veículos mais procurados nas conversas', '', '| # | Veículo | Conversas |', '|---:|---|---:|');
  resumo.topProcurados.slice(0, 20).forEach((r, i) => l.push(`| ${i + 1} | ${r.veiculo} | ${r.conversas} |`));
  l.push('', `${resumo.semVeiculo} conversas não citam um modelo identificável${resumo.aberturaSemVeiculo ? ` (${resumo.aberturaSemVeiculo} delas abrem com a assistente dizendo "se interessou no nosso" sem o nome do veículo)` : ''}.`);
  if (resumo.topTroca.length) {
    l.push('', '## Veículos oferecidos na troca', '', '| Veículo | Conversas |', '|---|---:|');
    resumo.topTroca.slice(0, 10).forEach((r) => l.push(`| ${r.veiculo} | ${r.conversas} |`));
  }
  const quentes = leads.filter((x) => x.temperatura === 'quente');
  const quentesSemVendedor = quentes.filter((x) => x.msgsVendedores === 0);
  l.push('', '## Leads quentes para negociação', '');
  l.push(`${quentesSemVendedor.length} dos ${quentes.length} leads quentes não têm nenhuma mensagem escrita por vendedor (só a assistente virtual conversou).`, '');
  l.push('| Lead | Telefone | Vendedor | Veículo | Sinais | Vendedor respondeu? |', '|---|---|---|---|---|---|');
  for (const lead of quentes.sort((a, b) => a.msgsVendedores - b.msgsVendedores)) {
    l.push(`| ${lead.nome || lead.contactId} | ${lead.telefone} | ${lead.vendedor} | ${lead.veiculosProcurados.join(', ') || '—'} | ${lead.motivo} | ${lead.msgsVendedores ? 'sim' : '**não**'} |`);
  }
  l.push('', '_Classificação automática pelo texto das conversas; áudios e imagens não são lidos. Revise os casos limítrofes no CSV._');
  return l.join('\n');
}

// ---------------------------------------------------------------------------

const dados = await carregarDados();
const nomes = new Map(dados.usuarios.map((u) => [
  u.id, u.name || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id,
]));
const telefonesEquipe = new Set(dados.usuarios.map((u) => u.phone).filter(Boolean));

let conversas = dados.conversas;
if (DESDE) conversas = conversas.filter((c) => Number(c.lastMessageDate || 0) >= DESDE.getTime());

// Conversas internas: contato é alguém da equipe ou só recebe alertas de "lead atribuído para você".
const ehInterna = (conversa) => {
  if (telefonesEquipe.has(conversa.phone)) return true;
  if (/top ?\+? ?(mais )?car|topmais/.test(normalizar(conversa.fullName || conversa.contactName))) return true;
  const saida = (dados.mensagens[conversa.id] || []).filter((m) => m.direction === 'outbound' && m.body);
  const alertas = saida.filter((m) => RE_ALERTA_INTERNO.test(normalizar(m.body))).length;
  return alertas > 0 && alertas >= saida.length / 2;
};
const internas = conversas.filter(ehInterna);
const analisadas = conversas
  .filter((c) => !internas.includes(c) && dados.mensagens[c.id])
  .map((c) => analisarConversa(c, dados.mensagens[c.id], nomes));
const leads = analisadas.filter((x) => x.temperatura !== 'fora');
const foraDoEscopo = analisadas.filter((x) => x.temperatura === 'fora');

const resumo = consolidar(leads);
await mkdir(SAIDA, { recursive: true });
const cabecalho = ['conversationId', 'contactId', 'nome', 'telefone', 'vendedor', 'temperatura', 'motivo', 'msgsLead', 'msgsVendedores',
  'msgsAutomacao', 'inicioConversa', 'inicioAtendimentoDono', 'baseDoTempo', 'tempoAteDono', 'veiculosProcurados', 'veiculosNaTroca'];
await writeFile(path.join(SAIDA, 'leads.csv'), `﻿${csv([cabecalho, ...leads.map((x) => [
  x.conversationId, x.contactId, x.nome, x.telefone, x.vendedor, x.temperatura, x.motivo, x.msgsLead, x.msgsVendedores,
  x.msgsAutomacao, x.inicioConversa, x.inicioAtendimentoDono, x.baseDoTempo, formatarMinutos(x.minutosAteDono),
  x.veiculosProcurados, x.veiculosNaTroca,
])])}`);
await writeFile(path.join(SAIDA, 'fora-do-escopo.csv'), `\uFEFF${csv([['conversationId', 'nome', 'telefone', 'vendedor', 'motivo', 'msgsLead'],
  ...foraDoEscopo.map((x) => [x.conversationId, x.nome, x.telefone, x.vendedor, x.motivo, x.msgsLead])])}`);
const { vendedores, ...resto } = resumo;
await writeFile(path.join(SAIDA, 'resumo.json'), JSON.stringify({
  geradoEm: new Date().toISOString(),
  conversasInternasExcluidas: internas.length,
  ...resto,
  vendedores: vendedores.map(({ tempos, ...v }) => v),
  leads,
}, null, 2));
const markdown = relatorioMarkdown(resumo, leads, internas.length, foraDoEscopo);
await writeFile(path.join(SAIDA, 'relatorio.md'), markdown);

console.log(`\n${markdown.split('\n## Leads quentes')[0]}`);
console.log(`\nArquivos gerados em ${SAIDA}/: relatorio.md, leads.csv, fora-do-escopo.csv, resumo.json`);
