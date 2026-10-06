# Prompt Universal — Auditoria, Vendas, Estoque e Feedback para CRM Automotivo

> Copie este prompt inteiro para uma nova sessão de Claude Code **em outro projeto de CRM**.
> Substitua os itens entre colchetes. Este prompt não é genérico "na teoria": cada requisito traz
> abaixo uma **implementação de referência** (código real, testado, rodando em produção no CRM
> Jotap — repositório `eazyclick-crm-novo`), incluindo os valores exatos (durações, volumes,
> offsets, animações) e os dois bugs reais que já encontramos e corrigimos lá. Use essa referência
> como ponto de partida fiel; adapte só o que depender do schema do novo projeto (nomes de
> tabela/coluna, estágios do funil, cargos).

## Papel e resultado esperado

Você é um engenheiro de software sênior trabalhando em um CRM automotivo existente (projeto
diferente do Jotap, mesma família de features). Estude o projeto antes de alterar arquivos e
implemente, de ponta a ponta, os requisitos abaixo, seguindo a arquitetura, o design visual, as
convenções, a autenticação e o modelo de dados já usados **neste** sistema — não copie nomes de
tabela/coluna do Jotap sem antes confirmar que existem aqui.

Não entregue apenas um plano ou exemplos: implemente, crie migrations idempotentes, escreva
testes antes do código, execute testes/type-check/build e corrija tudo o que estiver relacionado
à tarefa. Preserve alterações preexistentes do usuário e não faça refatorações fora do escopo.

Projeto/tenant: `[NOME DO CRM OU EMPRESA]`

Stack esperada: descubra no repositório; não presuma nomes de tabelas, colunas, estágios, roles
ou ferramentas de teste. (No Jotap era Next.js 14 App Router + Supabase + Vitest — o projeto novo
pode ser diferente.)

Assets de referência que o usuário deve anexar à sessão:

- imagem lateral do carro de referência: `[CAMINHO/ANEXO DA IMAGEM]`;
- áudio de carro acelerando: `[CAMINHO/ANEXO DO MP3 DO MOTOR]`;
- áudio de dinheiro/caixa registradora: `[CAMINHO/ANEXO DO MP3 DE DINHEIRO]`;
- áudio de notificação ping/ding para lead atribuído: `[CAMINHO/ANEXO DO MP3 DE NOTIFICAÇÃO]`.

Nunca baixe áudio de YouTube ou de outra fonte de terceiros. Use somente arquivos
anexados/fornecidos pelo usuário ou assets cuja licença tenha sido confirmada.

## Requisitos funcionais

### 1. Som ao transferir um lead + notificação de lead atribuído

Considere transferência como mudança real do responsável/vendedor do lead. Este requisito tem
**duas partes distintas** — no Jotap só a segunda foi implementada; confirme com o usuário se a
primeira é realmente necessária antes de construir do zero.

**1a. Som para quem transfere manualmente** (não implementado como referência — construa do
zero se pedido): tocar confirmação sonora curta somente depois de o banco confirmar a mudança;
não tocar se vendedor anterior e novo forem equivalentes após `trim`+lowercase; nunca usar arquivo
remoto; nunca deixar o som quebrar a transferência se autoplay for bloqueado.

**1b. Som para quem recebe o lead** — implementação de referência (`LeadAssignedWatcher.tsx`):

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

const INTERVALO_FALLBACK_MS = 180_000; // 3min — não 15s; 15s de polling constante é caro demais
const EVENTO_ATRIBUICOES = 'lead-assignments-changed';

export function LeadAssignedWatcher({ sellerName }: { sellerName: string }) {
  const idsAtribuidos = useRef<Set<number>>(new Set());
  const inicializado = useRef(false);

  useEffect(() => {
    if (!sellerName.trim()) return;
    const supabase = createClient();
    let active = true;

    async function verificarAtribuicoes(tocarNovas: boolean) {
      const { data, error } = await supabase
        .from('BASE_DE_LEADS') // troque pelo nome real da tabela de leads
        .select('id')
        .eq('vendedor', sellerName); // troque pela coluna real de responsável
      if (!active || error) return;

      const atuais = new Set(((data as { id: number }[]) ?? []).map((lead) => lead.id));
      const recebeuNovo =
        inicializado.current && Array.from(atuais).some((id) => !idsAtribuidos.current.has(id));
      const atribuicoesMudaram =
        inicializado.current &&
        (atuais.size !== idsAtribuidos.current.size ||
          Array.from(atuais).some((id) => !idsAtribuidos.current.has(id)));

      idsAtribuidos.current = atuais; // baseline sempre substituída, detecta reatribuição futura
      inicializado.current = true;

      if (atribuicoesMudaram) window.dispatchEvent(new CustomEvent(EVENTO_ATRIBUICOES));
      if (tocarNovas && recebeuNovo) {
        try {
          const audio = new Audio('/effects/lead-assigned.mp3');
          audio.preload = 'auto';
          audio.volume = 0.86;
          await audio.play();
        } catch {
          // autoplay bloqueado numa aba sem interação: nunca deve afetar a atribuição
        }
      }
    }

    void verificarAtribuicoes(false); // 1ª checagem: só grava baseline, nunca toca som
    const channel = supabase
      .channel(`lead-assigned-${sellerName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'BASE_DE_LEADS' }, () =>
        void verificarAtribuicoes(true)
      )
      .subscribe();
    const interval = window.setInterval(() => void verificarAtribuicoes(true), INTERVALO_FALLBACK_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [sellerName]);

  return null;
}
```

Pontos que fizeram esse padrão funcionar e não podem ser perdidos na adaptação:

- Monte esse componente **uma única vez** no layout autenticado (ex.: `app/(app)/layout.tsx`),
  não em cada página, senão o som toca duplicado. No Jotap ele está montado para qualquer usuário
  autenticado (`{userData.user && <LeadAssignedWatcher .../>}`); o ideal é restringir a
  `cargo === 'vendedor'`, já que outros cargos não precisam do som nem da query/canal extra.
- O `Set` de IDs é a baseline: nunca compare "mudou algum campo do lead", compare "existe um ID
  que não existia antes". Isso evita tocar som em updates comuns do mesmo lead.
- O evento `lead-assignments-changed` no `window` é o mecanismo pelo qual outras páginas (lista de
  leads, pipeline/kanban) re-buscam dados sem `location.reload()` — assine esse evento nas páginas
  que listam leads.
- Realtime sozinho não é suficiente: se a tabela não estiver na publication do Supabase Realtime
  (comum quando ela foi criada por outra automação/n8n antes do CRM existir), o polling de 180s é
  quem garante que a atribuição feita por fora do app ainda seja detectada.

### 2. Autoria e data da observação

Ao adicionar ou alterar a observação de um lead, exiba se foi "Adicionada" ou "Alterada", o nome
do responsável autenticado (fallback seguro para "Sistema"/"Usuário desconhecido") e data/hora no
locale do CRM. Não confie em nome enviado livremente pelo cliente; resolva o responsável no banco
a partir da identidade autenticada (via trigger de auditoria — item 3). Não sobrescreva a
observação antes de a persistência ser confirmada:

```tsx
async function salvarObservacao() {
  const { data, error } = await supabase
    .from('BASE_DE_LEADS')
    .update({ observacao_vendedor: observacao })
    .eq('id', lead.id)
    .select('id, observacao_vendedor')
    .maybeSingle();
  if (error || data?.id !== lead.id || data.observacao_vendedor !== observacao) {
    setMensagem('Não foi possível salvar a observação. Tente novamente.');
    return;
  }
  onUpdated({ ...lead, observacao_vendedor: data.observacao_vendedor });
}

// autoria/data não vêm de coluna própria — vêm do último log de auditoria (item 3) com
// acao começando em "observacao_", que é gravado por trigger e por isso cobre updates de fora
// da UI também:
const ultimoLogObservacao = logs.find((item) => item.acao.startsWith('observacao_'));
// render: `${acao === 'observacao_adicionada' ? 'Adicionada' : 'Alterada'} por
//   ${responsavel_nome ?? 'Usuário desconhecido'} em ${new Date(created_at).toLocaleString('pt-BR')}`
```

### 3. Logs gerais do lead

Abaixo do histórico de movimentações, crie "Logs Gerais", ordem decrescente de data, registrando
toda ação relevante possível no lead: criação/atualização de campos, mudança de estágio,
transferência de responsável, observação, etiquetas, IA/automação. Cada log com `id`, `id_lead`,
ação, responsável (ID e nome), detalhes em JSON, timestamp do banco. **Gere por trigger no banco**,
não em cada botão da UI — updates podem vir de API, webhook, n8n:

```sql
create table if not exists public.lead_logs (
  id bigserial primary key,
  id_lead bigint not null,
  acao text not null,
  responsavel_id uuid,
  responsavel_nome text,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lead_logs_lead_created_idx on public.lead_logs (id_lead, created_at desc);
alter table public.lead_logs enable row level security;
-- só SELECT para authenticated (via policy de dono/cargo); NENHUMA policy de insert/update/delete
-- para authenticated — só o trigger (SECURITY DEFINER) escreve, senão o cliente forja auditoria.

create or replace function public.audit_lead_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_old jsonb := case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
declare v_new jsonb := case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
declare v_acao text; declare v_campos text[]; declare v_nome text;
begin
  select nome into v_nome from public.profiles where id = auth.uid();
  if tg_op = 'DELETE' then v_acao := 'lead_excluido'; v_campos := array[]::text[];
  elsif tg_op = 'INSERT' then v_acao := 'lead_criado'; v_campos := array['nome_lead'];
  else
    select coalesce(array_agg(key order by key), array[]::text[]) into v_campos
      from jsonb_each(v_new) n where (v_old -> n.key) is distinct from n.value;
    if new.observacao_vendedor is distinct from old.observacao_vendedor then
      v_acao := case when nullif(trim(coalesce(old.observacao_vendedor,'')),'') is null
        then 'observacao_adicionada' else 'observacao_alterada' end;
    elsif new.vendedor is distinct from old.vendedor then v_acao := 'lead_transferido';
    elsif new.estagio_lead is distinct from old.estagio_lead then v_acao := 'estagio_alterado';
    else v_acao := 'lead_atualizado'; end if;
  end if;
  insert into public.lead_logs (id_lead, acao, responsavel_id, responsavel_nome, detalhes)
  values (coalesce(new.id, old.id), v_acao, auth.uid(),
    coalesce(v_nome, case when auth.uid() is null then 'Sistema/automação' else 'Usuário' end),
    jsonb_build_object('campos_alterados', v_campos));
  return coalesce(new, old);
end $$;
drop trigger if exists trg_audit_lead_changes on public."BASE_DE_LEADS";
create trigger trg_audit_lead_changes after insert or update or delete on public."BASE_DE_LEADS"
for each row execute function public.audit_lead_changes();
```

`SECURITY DEFINER` + `set search_path = public` explícito é obrigatório aqui — sem isso a função
roda com os privilégios de quem chamou (pode falhar por RLS ao ler `profiles`) e fica vulnerável a
sequestro de `search_path`.

UI: "Histórico de Movimentações" com **altura máxima e scroll interno** (`max-h-64 overflow-y-auto
pr-1` — 16rem foi o valor usado e testado; o requisito original pedia `max-h-72`/18rem, qualquer
um dos dois é aceitável, só mantenha consistência entre CSS e teste). "Logs Gerais" logo abaixo,
mesmo padrão de scroll, **com `.limit(N)` na query** — no Jotap esse limite ficou pendente de
implementar; não repita esse buraco no projeto novo, adicione paginação/limite desde o início.

### 4. Loading automotivo

Componente único e reutilizável, sem duplicar SVG entre páginas:

```tsx
export function AutomotiveLoading({ label = 'Carregando dados' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-32 flex-col items-center justify-center gap-3 text-gray-500">
      <svg className="automotive-loading h-12 w-24 text-primary" viewBox="0 0 96 48" fill="none" aria-hidden="true">
        <path d="M12 30h72l-7-13H35L24 26H12v4Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="27" cy="33" r="7" fill="white" stroke="currentColor" strokeWidth="3" />
        <circle cx="70" cy="33" r="7" fill="white" stroke="currentColor" strokeWidth="3" />
        <path d="M2 20h18M5 13h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}
```

```css
@keyframes automotive-drive { 0%,100% { transform: translateX(-8px); } 50% { transform: translateX(8px); } }
.automotive-loading { animation: automotive-drive 1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .automotive-loading { animation: none; } }
```

Sem biblioteca pesada, sem layout shift relevante, sem cobrir tela indefinidamente após erro (só
aparece durante `loading === true`, controlado pelo estado da página, nunca sozinho).

### 5. Venda fechada com dados obrigatórios

Ao mover um lead para o estágio real de venda fechada: nome não vazio, valor numérico finito
maior que zero; se faltar algo, **não** faça optimistic move — abra modal acessível preenchido com
os dados atuais, salve dados+estágio atomicamente, só atualize a UI após confirmação:

```tsx
// No handler de drag-and-drop / mudança de estágio:
if (novoEstagio === 'fechado' && (!leadAtual.nome_lead?.trim() || !leadAtual.valor || leadAtual.valor <= 0)) {
  setVendaPendente(leadAtual); // abre o modal, NÃO move o card
  return;
}

async function confirmarVenda(nome: string, valor: number) {
  const { data, error } = await supabase
    .from('BASE_DE_LEADS')
    .update({ nome_lead: nome, valor, estagio_lead: 'fechado' }) // um único update atômico
    .eq('id', vendaPendente.id)
    .select('*')
    .single();
  if (error || !data) {
    setErrorMessage('Não foi possível fechar a venda. Verifique os dados e tente novamente.');
    return; // modal continua aberto com os dados, usuário tenta de novo
  }
  setLeads((prev) => prev.map((item) => (item.id === vendaPendente.id ? data : item)));
  setVendaPendente(null);
  setCelebracao(nome); // só dispara a celebração DEPOIS da confirmação
}
```

Descubra o **valor exato do estágio aceito pela constraint real** antes de codificar (no Jotap é a
string `'fechado'`; não presuma `venda_fechada`/`ganho`/etc.). Implemente a mesma proteção no
banco com `BEFORE INSERT OR UPDATE OF estagio_lead, nome_lead, valor`:

```sql
create or replace function public.validar_fechamento_lead() returns trigger
language plpgsql set search_path = public as $$
begin
  if lower(trim(coalesce(new.estagio_lead,''))) = 'fechado' -- troque pelo valor real do estágio
    and (nullif(trim(coalesce(new.nome_lead,'')),'') is null or new.valor is null or new.valor <= 0)
  then raise exception 'Nome do lead e valor maior que zero são obrigatórios para fechar a venda.'
    using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_validar_fechamento_lead on public."BASE_DE_LEADS";
create trigger trg_validar_fechamento_lead before insert or update of estagio_lead, nome_lead, valor
  on public."BASE_DE_LEADS" for each row execute function public.validar_fechamento_lead();
```

### 6. Status do estoque

Três estados canônicos (disponível/indisponível/vendido). Comportamento: por padrão mostra só
disponíveis; vendidos/indisponíveis aparecem só com filtro explícito ou "Todos"; no detalhe do
veículo, permita alterar o status e persista na coluna real; atualize UI só após confirmação, ou
rollback total em erro:

```tsx
const [statusFiltro, setStatusFiltro] = useState('Disponível'); // NUNCA inicie em "Todos"

async function atualizarStatus(status) {
  const { data, error } = await supabase
    .from('estoque') // confirme o nome/caixa REAL da tabela antes de escrever isso
    .update({ status })
    .eq('id', selecionado.id)
    .select('id, status')
    .single();
  if (error || data?.status !== status) {
    setErroStatus('Não foi possível alterar o status do veículo.');
    return; // nada no estado local muda — rollback implícito
  }
  setSelecionado({ ...selecionado, status });
  setVeiculos((prev) => prev.map((v) => (v.id === selecionado.id ? { ...v, status } : v)));
}
```

Antes de escrever migration/query, confirme: (a) o status é texto livre, enum ou FK; (b) o **nome
exato e a caixa** da tabela — no Jotap existiam duas tabelas parecidas no schema, `public.estoque`
(minúscula, real, usada pela aplicação) e uma legada `public."ESTOQUE"` (maiúscula, órfã de uma
migration antiga); usar a errada faz a query "funcionar" silenciosamente contra a tabela vazia
errada ou falhar tudo. Se houver dados legados com caixa/acento inconsistente
(`Disponível`/`INDISPONIVEL`), normalize só na **comparação**, nunca grave um valor fora do que a
constraint real aceita.

**Pegadinha real já encontrada e corrigida no Jotap — confira isso especificamente no projeto
novo:** se o schema já tinha RLS habilitado nessa tabela de estoque e, em algum momento, uma
migration de "hardening" trocou uma policy antiga `for all` por uma nova só de `select` (comum
quando se aperta segurança recriando policies), a troca de status passa a falhar **silenciosamente**
(RLS bloqueia o `UPDATE`, 0 linhas afetadas, `.single()` estoura erro, a UI mostra uma mensagem
genérica de erro). Sintoma: o usuário reporta "não consigo alterar o status do veículo" sem
nenhum erro óbvio no console. Diagnóstico: procure, na ordem cronológica das migrations, se existe
`create policy ... for update` (ou `for all`) na tabela real de estoque — se só existir `for
select`, é isso. Correção: nova migration idempotente adicionando a policy de `update` que falta.

### 6.1. Veículo obrigatório no fechamento da venda

Ao mover um lead para o estágio real `fechado`, abra sempre o modal e exija também a escolha do veículo vendido. A solução usada no JOTA-P deve ser replicada adaptando somente nomes reais de tabelas, colunas e tipos:

- consultar somente a tabela de estoque realmente usada pela UI; no JOTA-P é `public.estoque` minúscula, não `public."ESTOQUE"`;
- usar um combobox digitável, pesquisando marca, modelo, ano ou placa;
- abrir a lista abaixo do campo com `top-full`, altura `max-h-60` e `overflow-y-auto`;
- não usar um `<select>` nativo enorme;
- carregar somente veículos cujo status normalizado seja `disponivel`;
- abrir o modal em toda tentativa de fechar, mesmo quando nome e valor já estão preenchidos;
- gravar uma referência estável no lead, como `estoque_veiculo_id`;
- chamar uma RPC transacional `fechar_venda_com_veiculo`, em vez de dois updates separados no cliente;
- dentro da RPC, exigir `auth.uid()`, validar cargo ou vendedor responsável, travar lead e veículo com `FOR UPDATE` e revalidar a disponibilidade;
- atualizar o estoque para o valor real aceito pela aplicação (`Vendido` no JOTA-P) e fechar o lead na mesma transação;
- usar `SECURITY DEFINER` com `search_path = public`, revogar execução de `PUBLIC` e `anon` e conceder somente a `authenticated`;
- manter modal e dados na tela se o veículo tiver sido vendido/indisponibilizado por outro usuário;
- criar migration nova e aditiva; nunca editar uma migration que já possa ter sido executada.

Erros específicos a prevenir:

- apontar a RPC para uma tabela homônima com caixa diferente;
- confiar na disponibilidade carregada pelo navegador sem verificar novamente no banco;
- não usar bloqueio de linha e permitir duas vendas do mesmo carro;
- marcar o lead como fechado antes de atualizar o estoque;
- fechar o modal ou iniciar a celebração antes da confirmação da RPC;
- liberar uma função `SECURITY DEFINER` sem autorização interna;
- substituir alterações preexistentes deste prompt ao acrescentar esta seção.

Critérios adicionais de aceite:

- o usuário digita parte da marca/modelo/ano/placa e escolhe numa lista que abre para baixo;
- somente veículos disponíveis aparecem;
- após sucesso, o lead guarda o veículo e o estoque mostra `Vendido`;
- duas tentativas concorrentes não conseguem vender o mesmo veículo;
- qualquer falha deixa o lead fora de `fechado` e mantém o modal utilizável.

### 7. Celebração visual e sonora da venda fechada

Depois que o banco confirmar com sucesso a movimentação para o estágio real de venda fechada,
celebração em tela cheia, **5 segundos**, título exato **"Parabéns pela venda!"**, subtítulo com o
nome do lead, fundo escuro translúcido com `backdrop-blur`, carro esportivo em perfil lateral
entrando pela direita e saindo pela esquerda, rastros de velocidade e neon azul/ciano, clique
encerra antes, `role="status"` `aria-live="assertive"`, respeita `prefers-reduced-motion`.

Implementação de referência completa (`SaleCelebration.tsx`):

```tsx
'use client';
import Image from 'next/image';
import { useEffect } from 'react';

const CELEBRATION_DURATION_MS = 5_000;

export function SaleCelebration({ leadName, onClose }: { leadName: string; onClose: () => void }) {
  useEffect(() => {
    const engine = new Audio('/effects/sale-engine.mp3');
    const money = new Audio('/effects/sale-money.mp3');
    let finished = false;
    engine.volume = 0.58;
    money.volume = 0.82;

    const playAt = (audio: HTMLAudioElement, time: number) => {
      const play = () => { if (finished) return; audio.currentTime = time; void audio.play().catch(() => undefined); };
      if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) play();
      else audio.addEventListener('loadedmetadata', play, { once: true });
      audio.load();
      return () => audio.removeEventListener('loadedmetadata', play);
    };

    const removeEngineMetadata = playAt(engine, 11); // motor começa no segundo 11
    const removeMoneyMetadata = playAt(money, 5);     // dinheiro começa no segundo 5

    function stopAndClose() {
      if (finished) return;
      finished = true;
      removeEngineMetadata(); removeMoneyMetadata();
      engine.pause(); engine.currentTime = 0;
      money.pause(); money.currentTime = 0;
      onClose();
    }

    const timer = window.setTimeout(stopAndClose, CELEBRATION_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
      finished = true;
      removeEngineMetadata(); removeMoneyMetadata();
      engine.pause(); money.pause();
    };
  }, [onClose]);

  return (
    <button type="button" onClick={onClose} role="status" aria-live="assertive"
      className="sale-celebration fixed inset-0 z-[100] overflow-hidden bg-slate-950/90 backdrop-blur-sm motion-reduce:transition-none">
      <div className="sale-speed-lines" aria-hidden="true" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <h2 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">Parabéns pela venda!</h2>
        <p className="mt-2 text-base text-slate-300">{leadName} avançou para a linha de chegada.</p>
        <div className="sale-car-stage mt-8" aria-hidden="true">
          <div className="sale-car-glow" />
          <Image className="sale-car sale-car-right-to-left" src="/effects/sale-car-neon.png" alt=""
            width={1536} height={1024} priority style={{ animationDuration: `${CELEBRATION_DURATION_MS}ms` }} />
        </div>
      </div>
    </button>
  );
}
```

```css
.sale-celebration { animation: sale-fade-in 240ms ease-out both; }
.sale-car-stage { position: relative; width: min(88vw, 35rem); height: 15.5rem; }
.sale-car { position: relative; z-index: 2; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 16px 22px rgb(0 0 0 / 55%)); }
.sale-car-right-to-left { animation: sale-car-right-to-left 5s cubic-bezier(.22,.72,.25,1) both; }
.sale-car-glow { position: absolute; inset: 48% 8% 3%; border-radius: 9999px; background: linear-gradient(90deg, transparent, rgb(56 189 248 / 55%), rgb(245 158 11 / 45%), transparent); filter: blur(24px); animation: sale-glow 1.4s ease-in-out infinite alternate; }
.sale-speed-lines { position: absolute; inset: 0; opacity: .32; background: linear-gradient(100deg, transparent 8%, rgb(56 189 248 / 70%) 8.2%, transparent 8.6%), linear-gradient(96deg, transparent 35%, rgb(245 158 11 / 50%) 35.2%, transparent 35.6%), repeating-linear-gradient(0deg, transparent 0 62px, rgb(148 163 184 / 10%) 63px 64px); transform: skewX(-12deg) scale(1.2); animation: sale-lines 900ms linear infinite; }
@keyframes sale-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes sale-car-right-to-left { 0% { opacity: 0; transform: translateX(100vw) scale(.86); } 8% { opacity: 1; } 24% { opacity: 1; transform: translateX(10vw) scale(1.02); } 68% { opacity: 1; transform: translateX(-8vw) scale(1); } 86% { opacity: 1; } 100% { opacity: 0; transform: translateX(-110vw) scale(.9); } }
@keyframes sale-glow { from { opacity: .45; transform: scaleX(.88); } to { opacity: 1; transform: scaleX(1.08); } }
@keyframes sale-lines { from { background-position: 0 0, 0 0, 0 0; } to { background-position: -280px 0, -190px 0, 0 64px; } }
@media (prefers-reduced-motion: reduce) { .sale-celebration, .sale-car-right-to-left, .sale-car-glow, .sale-speed-lines { animation: none; } }
```

O carro deve ser fiel à imagem de referência (cupê esportivo japonês fim-dos-anos-90 em perfil,
carroceria prata/branca, grafismos geométricos azuis, aerofólio alto, rodas cromadas, pinças de
freio vermelhas, vidros azul-escuros, contorno neon ciano/azul, sem marca/texto/watermark). Gere
sobre chroma-key uniforme, remova o fundo, **valide de verdade que o canal alfa ficou
transparente** (não só "parece" transparente no preview — no Jotap validamos isso lendo o
`PixelFormat`/canal A dos pixels de borda; um PNG com fundo preto opaco passa despercebido em
alguns visualizadores). Salve em `public/effects/sale-car-neon.png`; não deixe o chroma
intermediário no projeto.

**Pegadinha real já encontrada e corrigida no Jotap — confira isso especificamente no projeto
novo se ele tiver um middleware de autenticação:** se existir um `middleware.ts` que exige sessão
autenticada em praticamente todas as rotas (padrão comum com `@supabase/ssr`), e esse middleware
**não excluir explicitamente os assets estáticos que o `next/image` vai otimizar**, o carro da
celebração aparece como ícone de imagem quebrada mesmo com o PNG correto no disco e mesmo com o
usuário logado no navegador. Causa: o otimizador de imagem do Next faz, para imagens locais, um
**fetch interno servidor-a-servidor** para buscar o arquivo (não lê direto do disco), e esse fetch
interno não carrega o cookie de sessão da requisição original do navegador — se o middleware
exigir auth nesse caminho, o fetch interno cai num redirect para `/login` (HTML), e o otimizador
recebe HTML em vez de bytes de imagem, falhando com "The requested resource isn't a valid image".
Diagnóstico rápido: `curl -o /dev/null -w '%{http_code}\n' http://localhost:3000/_next/image?url=%2Feffects%2Fsale-car-neon.png&w=800&q=75` — se vier `400`/`307` em vez de `200`, é isso.
Correção: adicionar o diretório de assets públicos (`effects/` ou equivalente) à exclusão do
`matcher` do middleware, junto com `_next/static`/`_next/image`/`favicon.ico`:

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|effects/).*)'],
};
```

Isso é seguro porque esses assets (imagem do carro, sons de efeito) não carregam dado sensível —
não é o mesmo que abrir uma rota de dados.

Durante a celebração, toque os dois áudios simultaneamente, com pré-carregamento e `currentTime`
setado após `loadedmetadata` (ver código acima); se um falhar/for bloqueado, o outro continua e a
venda jamais é revertida.

## Processo obrigatório

1. Leia instruções locais (`AGENTS.md`/`CLAUDE.md`, skills aplicáveis, documentação) do projeto novo.
2. Rode `git status --short` e preserve o trabalho do usuário.
3. Mapeie componentes, rotas/API, migrations, tipos, testes e queries de leads/estoque **deste**
   projeto — não assuma que a estrutura do Jotap se repete.
4. Descubra os nomes exatos de tabela/coluna e constraints. Atenção especial a identificadores com
   espaços, acentos, maiúsculas e aliases do Supabase (o caso real `estoque` vs `"ESTOQUE"` do
   Jotap é o tipo de armadilha a procurar).
5. Verifique se o banco é compartilhado com n8n, webhooks, bots ou outra automação. Não aplique
   migration no banco ativo sem autorização explícita.
6. Antes de migration compartilhada, oriente backup lógico de schema/dados/roles e valide os
   payloads da outra automação.
7. Escreva um plano em `docs/superpowers/plans/YYYY-MM-DD-<tema>.md`.
8. Use TDD: teste falhando pelo motivo esperado, implementação mínima, teste passando, refatoração.
9. Prefira funções puras para normalização/validação e testes de integração/contrato para SQL e
   componentes (no Jotap os testes eram "lê o arquivo fonte e verifica strings-chave" — simples e
   funcionou bem para pegar regressão de comportamento sem mockar Supabase).
10. Crie migrations idempotentes com `if not exists`, `create or replace`, `drop trigger/policy if
    exists`.
11. Verifique RLS e multi-tenant. Nunca transforme auditoria em acesso global indevido. **Sempre
    que criar/recriar policies de RLS numa tabela existente, confirme que INSERT/UPDATE/DELETE
    ainda têm policy — é fácil, ao "apertar" segurança trocando uma policy `for all` antiga,
    esquecer de recriar a de escrita e deixar só `select`.**
12. Execute todos os testes, `tsc --noEmit` (ou script equivalente), lint disponível, build, e
    teste manualmente com `curl` os endpoints de asset estático/`_next/image` se houver middleware
    de auth.
13. Revise o diff contra cada requisito e relate migrations que ainda precisam ser aplicadas no
    ambiente.

## Erros conhecidos que devem ser prevenidos

- Salvar logs manualmente em cada botão e perder ações vindas de API/webhook.
- Permitir `INSERT/UPDATE/DELETE` direto na tabela de logs e possibilitar auditoria falsa.
- Usar `auth.uid()` sem `SECURITY DEFINER`/`search_path` seguro na função que precisa consultar perfis.
- Criar trigger recursivo que atualiza o lead e gera logs infinitos.
- Registrar somente histórico de estágio e chamar isso de "logs gerais".
- Exibir autoria atual para uma observação antiga sem ter um evento persistido correspondente.
- Abrir o modal depois de já mover o card de forma otimista.
- Aceitar valor `0`, negativo, `NaN`, vazio convertido para zero ou nome só com espaços.
- Validar fechamento apenas no client.
- Fazer dois updates separados (dados e estágio) e deixar estado parcial se o segundo falhar.
- Inventar o valor do estágio (`venda_fechada`, `ganho`) sem conferir a constraint real.
- Iniciar o filtro do estoque em "Todos" e expor vendidos na listagem normal.
- Comparar status sem normalizar acentos/caixa ou persistir label de UI no lugar do valor canônico.
- Fechar o modal/alterar UI antes de confirmar update do estoque.
- **Recriar/"endurecer" policies de RLS numa tabela e deixar só `select`, esquecendo `update`/`insert` — sintoma: update "falha" sem erro óbvio, 0 linhas afetadas.**
- Tocar som antes da persistência, a cada render ou sem capturar rejeição de autoplay.
- Tocar a notificação de atribuição para leads que já estavam com o vendedor quando ele abriu a tela.
- Tocar a notificação a cada update do mesmo lead, em vez de comparar o conjunto de IDs atribuídos.
- Depender apenas de Realtime e perder atribuições feitas por automações quando a tabela não está na publication.
- Montar um watcher por página e gerar múltiplos sons; ele deve existir uma vez no layout autenticado.
- Usar áudio remoto, muito alto, longo ou impossível de desativar pelo navegador.
- Tocar somente dinheiro ou somente motor quando o requisito exige os dois simultaneamente.
- Iniciar o motor em `0s` em vez de `11s`, ou o dinheiro em `0s` em vez de `5s`.
- Deixar um áudio continuar depois que a animação de 5 segundos terminou.
- Reutilizar o MP3 inteiro sem controlar `currentTime`, duração e volume.
- Deixar fundo branco/verde/preto opaco no asset do carro sem validar o canal alfa de verdade, ou manter o arquivo chroma intermediário no projeto.
- Fazer o carro andar da esquerda para a direita; a direção exigida é direita para esquerda.
- Usar título diferente de "Parabéns pela venda!".
- Animação contínua sem `prefers-reduced-motion`.
- Histórico de movimentações sem altura máxima/scroll interno.
- Query de logs sem índice/limite, degradando drawers de leads antigos.
- Usar nomes camelCase na query quando a coluna real contém espaços/acentos.
- Criar migration dependente de tabela que pode não existir sem verificar a ordem histórica.
- Ocultar erro do Supabase e deixar optimistic state divergente do banco.
- Alterar políticas RLS existentes sem entender vendedor, gerente, admin e tenant.
- Tratar falha de migration/schema cache como sucesso silencioso.
- **Ter um middleware de auth que bloqueia o fetch interno do `next/image` para assets locais em `public/`, quebrando qualquer `<Image src="/algo-local.png">` renderizado atrás de login — exclua o diretório de assets públicos do matcher.**

## Critérios de aceite

- Transferência confirmada toca uma vez; falha ou ausência de mudança não toca.
- Vendedor destinatário ouve `lead-assigned.mp3` uma vez quando um novo lead é atribuído a ele, sem som no carregamento inicial e sem repetição em updates comuns.
- Venda confirmada mostra "Parabéns pela venda!" por 5 segundos, com o carro fiel à referência atravessando da direita para a esquerda, **visível de verdade** (sem ícone de imagem quebrada, mesmo atrás de middleware de auth).
- Motor começa em 11s e dinheiro começa em 5s; ambos tocam juntos e param após 5 segundos.
- Observação mostra último autor e data/hora persistidos.
- Logs gerais exibem ações do client e de updates externos cobertos pelos triggers, com limite/paginação na query.
- Histórico de movimentações possui scroll interno e não aumenta indefinidamente o drawer.
- Loading de carro aparece nas telas principais e é acessível.
- Nenhum caminho consegue persistir estágio fechado com nome vazio ou valor menor/igual a zero.
- Modal permite corrigir dados e conclui a movimentação sem estado intermediário incorreto.
- Estoque abre mostrando somente disponíveis, permite consultar/alterar os três status, **e a alteração realmente persiste** (RLS de UPDATE confirmada, não só SELECT).
- Erros de banco ficam visíveis e a UI continua consistente.
- Migrations são reaplicáveis, RLS permanece segura (com policies de escrita presentes onde necessário), testes/type-check/build passam.

## Formato da entrega

Ao finalizar, informe objetivamente:

- o que foi implementado por requisito;
- migrations criadas e como aplicá-las;
- testes/comandos executados e resultados (`npm test`, `tsc --noEmit`, `npm run build`);
- arquivos principais alterados;
- se há middleware de auth, o resultado do teste manual de `/_next/image` para o asset local do carro;
- se há RLS na tabela de estoque, confirmação explícita de que a policy de `update` existe (não só `select`);
- limitações reais ou validações manuais pendentes;
- link para qualquer documentação/prompt produzido.
