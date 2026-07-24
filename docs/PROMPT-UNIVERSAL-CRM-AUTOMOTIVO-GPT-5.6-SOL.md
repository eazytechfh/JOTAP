# Prompt Universal — Auditoria, Vendas, Estoque e Feedback para CRM Automotivo

> Copie este prompt inteiro para uma nova sessão com o GPT‑5.6‑SOL. Substitua somente os itens entre colchetes quando necessário.

## Papel e resultado esperado

Você é um engenheiro de software sênior trabalhando em um CRM automotivo existente. Estude o projeto antes de alterar arquivos e implemente, de ponta a ponta, os requisitos abaixo, seguindo a arquitetura, o design visual, as convenções, a autenticação e o modelo de dados já usados pelo sistema.

Não entregue apenas um plano ou exemplos: implemente, crie migrations idempotentes, escreva testes antes do código, execute testes/type-check/build e corrija tudo o que estiver relacionado à tarefa. Preserve alterações preexistentes do usuário e não faça refatorações fora do escopo.

Projeto/tenant: `[NOME DO CRM OU EMPRESA]`

Stack esperada: descubra no repositório; não presuma nomes de tabelas, colunas, estágios, roles ou ferramentas de teste.

Assets de referência que o usuário deve anexar à sessão:

- imagem lateral do carro de referência: `[CAMINHO/ANEXO DA IMAGEM]`;
- áudio de carro acelerando: `[CAMINHO/ANEXO DO MP3 DO MOTOR]`;
- áudio de dinheiro/caixa registradora: `[CAMINHO/ANEXO DO MP3 DE DINHEIRO]`.
- áudio de notificação ping/ding para lead atribuído: `[CAMINHO/ANEXO DO MP3 DE NOTIFICAÇÃO]`.

Nunca baixe áudio de YouTube ou de outra fonte de terceiros. Use somente arquivos anexados/fornecidos pelo usuário ou assets cuja licença tenha sido confirmada.

## Requisitos funcionais

### 1. Som ao transferir um lead

Considere transferência como mudança real do responsável/vendedor do lead.

- Para quem realiza manualmente a transferência, toque uma confirmação sonora curta somente depois de o banco confirmar a mudança.
- Não toque se o vendedor anterior e o novo forem equivalentes após trim e normalização de caixa.
- O som é feedback auxiliar: bloqueio de autoplay, ausência de Web Audio API ou erro de áudio nunca pode desfazer nem quebrar a transferência.
- Não use arquivo remoto. Prefira Web Audio API ou um asset local pequeno.
- Evite sons duplicados causados por re-render, optimistic update ou eventos realtime repetidos.
- O vendedor que recebe o lead deve ouvir o MP3 fornecido, salvo como `public/effects/lead-assigned.mp3`, mesmo quando a atribuição vier de outra tela ou automação externa.
- Monte um watcher global somente no layout autenticado do cargo `vendedor`.
- Ao abrir a tela, consulte silenciosamente os IDs já atribuídos ao vendedor e use-os como linha de base: não toque para leads antigos.
- Acompanhe `postgres_changes` de `BASE_DE_LEADS` e, após o evento, confirme no banco os IDs cujo campo `vendedor` corresponde exatamente ao nome do usuário autenticado.
- Toque `lead-assigned.mp3` uma única vez quando surgir ao menos um ID que não existia no conjunto anterior.
- Substitua o conjunto anterior pelo conjunto atual em toda verificação, permitindo detectar corretamente uma reatribuição futura.
- Use polling leve de aproximadamente 15 segundos como fallback para automações ou ambientes onde a tabela não está habilitada na publication do Supabase Realtime.
- Remova channel e intervalo no cleanup do componente.
- Não toque em atualizações comuns de um lead que já pertence ao vendedor.
- O watcher deve retornar `null` e não criar popup visual adicional.
- Capture falhas de `audio.play()`: uma aba sem interação pode bloquear autoplay e isso nunca deve afetar a atribuição.

### 2. Autoria e data da observação

Ao adicionar ou alterar a observação de um lead, exiba:

- se foi “Adicionada” ou “Alterada”;
- nome do responsável autenticado (com fallback seguro para “Sistema” ou “Usuário desconhecido”);
- data e hora no locale do CRM.

Não confie em nome enviado livremente pelo cliente. Resolva o responsável no banco a partir da identidade autenticada. Não sobrescreva a observação antes de a persistência ser confirmada.

### 3. Logs gerais do lead

Abaixo do histórico de movimentações, crie “Logs Gerais”, em ordem decrescente de data, registrando toda ação relevante possível no lead:

- criação e atualização de campos;
- mudança de estágio;
- transferência de responsável;
- adição/alteração de observação;
- adição/remoção de etiquetas;
- alterações de automação/IA e demais ações existentes no projeto.

Cada log deve ter `id`, `id_lead`, ação, responsável (ID e nome), detalhes estruturados em JSON e timestamp do banco. Gere logs por triggers/funções no banco sempre que possível, pois updates podem vir da UI, API, webhook, n8n ou integração externa. Clientes autenticados podem ler os logs permitidos, mas não podem forjar, editar ou apagar auditoria.

Evite registrar segredos, tokens, senhas ou payloads sensíveis. Para updates, registre campos alterados e estados antes/depois apenas quando apropriado. Crie índice por `(id_lead, created_at desc)`, FK com política de exclusão coerente e RLS compatível com o isolamento do CRM.

O “Histórico de Movimentações” deve ter altura máxima aproximada de `18rem` (`max-h-72` no Tailwind), `overflow-y-auto` e pequeno padding à direita. A rolagem deve acontecer dentro do histórico, sem aumentar indefinidamente o drawer. A lista de Logs Gerais também deve ser limitada/paginada; não carregue auditoria ilimitada.

### 4. Loading automotivo

Crie um componente reutilizável de carregamento com um carro animado no estilo visual atual do CRM e use-o nos principais carregamentos de dados.

- Deve ter `role="status"`, texto acessível e `aria-live`.
- Respeite `prefers-reduced-motion`.
- Não adicione biblioteca pesada apenas para a animação.
- Não provoque layout shift relevante nem cubra indefinidamente telas após erro.
- Centralize o componente; não copie o mesmo SVG/CSS em várias páginas.

### 5. Venda fechada com dados obrigatórios

Ao mover um lead para o estágio real de venda fechada:

- nome do lead deve ser não vazio;
- valor deve ser numérico, finito e maior que zero;
- se faltar algo, não faça optimistic move para “Fechado”;
- abra um modal acessível preenchido com os dados atuais, explique os erros e permita editar nome/valor;
- salve dados e estágio de forma atômica quando possível;
- só atualize a UI definitivamente após confirmação;
- em falha, mantenha o modal/dados, mostre erro e permita tentar de novo.

Implemente a mesma proteção no banco (`BEFORE INSERT OR UPDATE` ou constraint equivalente). Validação apenas no React é insuficiente porque integrações externas podem contorná-la. Use exatamente o valor de estágio aceito pela constraint real; descubra-o antes de codificar.

### 6. Status do estoque

O estoque deve suportar três estados canônicos:

- `disponivel`;
- `indisponivel`;
- `vendido`.

Comportamento:

- por padrão, mostre apenas disponíveis;
- vendidos e indisponíveis aparecem quando o usuário escolhe o filtro correspondente ou “Todos”;
- no detalhe do veículo, permita alterar o status e persista na coluna real do banco;
- atualize lista/modal apenas após confirmação, ou faça rollback completo em erro;
- normalize para comparação valores legados com caixa/acento diferentes (`Disponível`, `INDISPONIVEL`), sem enviar valores incompatíveis com uma constraint existente;
- confirme se o status é texto, enum ou FK antes de escrever migration/query.

### 7. Celebração visual e sonora da venda fechada

Depois que o banco confirmar com sucesso a movimentação para o estágio real de venda fechada, apresente uma celebração em tela cheia. Não dispare antes da persistência e não dispare quando o update falhar.

Comportamento exato:

- duração total: **5 segundos**;
- título exato: **“Parabéns pela venda!”**;
- subtítulo com o nome do lead;
- fundo escuro translúcido com `backdrop-blur`;
- carro esportivo em perfil lateral, entrando pela direita, atravessando a tela e saindo pela esquerda;
- movimento completo da direita para a esquerda durante os 5 segundos;
- rastros de velocidade e iluminação neon azul/ciano;
- clique em qualquer ponto encerra antecipadamente;
- encerramento automático após 5.000 ms;
- `role="status"` e `aria-live="assertive"`;
- respeitar `prefers-reduced-motion`, removendo animações para usuários que solicitaram movimento reduzido.

O carro deve ser o mais fiel possível à imagem de referência fornecida:

- cupê esportivo japonês do final dos anos 1990 em vista lateral;
- carroceria prata/branca;
- grafismos geométricos azuis nas laterais;
- perfil baixo, para-choque dianteiro alongado e saias laterais;
- aerofólio traseiro alto;
- rodas cromadas grandes;
- pinças de freio vermelhas;
- vidros azul-escuros;
- contorno neon ciano/azul;
- sem marcas, logos, textos ou watermark.

Use a skill/ferramenta de geração de imagens disponível para criar um asset próprio derivado da referência. Gere sobre chroma-key uniforme, remova o fundo e valide transparência/arestas. Salve o PNG final em `public/effects/sale-car-neon.png`; não deixe o chroma intermediário no projeto.

Durante a celebração, toque **os dois áudios simultaneamente**:

1. `public/effects/sale-engine.mp3`
   - usar o MP3 de motor fornecido pelo usuário;
   - iniciar exatamente no segundo `11`;
   - volume aproximado `0.58`;
   - interromper após `5.000 ms`.

2. `public/effects/sale-money.mp3`
   - usar o MP3 de dinheiro/caixa registradora fornecido pelo usuário;
   - iniciar exatamente no segundo `5`;
   - volume aproximado `0.82`;
   - interromper após `5.000 ms`.

Pré-carregue os dois arquivos, espere `loadedmetadata` antes de definir `currentTime` quando necessário e capture individualmente erros de `play()`. Se um áudio falhar ou for bloqueado, o outro deve continuar e a venda jamais pode ser revertida. Não reproduza os sons por renderização ou polling; execute uma única vez após a confirmação da venda.

## Processo obrigatório

1. Leia instruções locais (`AGENTS.md`, skills aplicáveis e documentação).
2. Rode `git status --short` e preserve o trabalho do usuário.
3. Mapeie componentes, rotas/API, migrations, tipos, testes e queries de leads/estoque.
4. Descubra os nomes exatos de tabela/coluna e constraints. Atenção especial a identificadores com espaços, acentos, maiúsculas e aliases do Supabase.
5. Verifique se o banco é compartilhado com n8n, webhooks, bots ou outra automação. Não aplique migration no banco ativo sem autorização explícita.
6. Antes de migration compartilhada, oriente backup lógico de schema/dados/roles e valide os payloads da outra automação.
7. Escreva um plano em `docs/superpowers/plans/YYYY-MM-DD-<tema>.md`.
8. Use TDD: teste falhando pelo motivo esperado, implementação mínima, teste passando e refatoração.
9. Prefira funções puras para normalização/validação e testes de integração/contrato para SQL e componentes.
10. Crie migrations idempotentes com `if not exists`, `create or replace`, `drop trigger/policy if exists`.
11. Verifique RLS e multi-tenant. Nunca transforme auditoria em acesso global indevido.
12. Execute todos os testes, `tsc --noEmit` (ou script equivalente), lint disponível, build e `git diff --check`.
13. Revise o diff contra cada requisito e relate migrations que ainda precisam ser aplicadas no ambiente.

## Erros conhecidos que devem ser prevenidos

- Salvar logs manualmente em cada botão e perder ações vindas de API/webhook.
- Permitir `INSERT/UPDATE/DELETE` direto na tabela de logs e possibilitar auditoria falsa.
- Usar `auth.uid()` sem `SECURITY DEFINER`/`search_path` seguro na função que precisa consultar perfis.
- Criar trigger recursivo que atualiza o lead e gera logs infinitos.
- Registrar somente histórico de estágio e chamar isso de “logs gerais”.
- Exibir autoria atual para uma observação antiga sem ter um evento persistido correspondente.
- Abrir o modal depois de já mover o card de forma otimista.
- Aceitar valor `0`, negativo, `NaN`, vazio convertido para zero ou nome só com espaços.
- Validar fechamento apenas no client.
- Fazer dois updates separados (dados e estágio) e deixar estado parcial se o segundo falhar.
- Inventar o valor do estágio (`venda_fechada`, `ganho`) sem conferir a constraint real.
- Iniciar o filtro do estoque em “Todos” e expor vendidos na listagem normal.
- Comparar status sem normalizar acentos/caixa ou persistir label de UI no lugar do valor canônico.
- Fechar o modal/alterar UI antes de confirmar update do estoque.
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
- Deixar fundo branco/verde no asset do carro ou manter o arquivo chroma intermediário no projeto.
- Fazer o carro andar da esquerda para a direita; a direção exigida é direita para esquerda.
- Usar título diferente de “Parabéns pela venda!”.
- Animação contínua sem `prefers-reduced-motion`.
- Histórico de movimentações sem altura máxima/scroll interno.
- Query de logs sem índice/limite, degradando drawers de leads antigos.
- Usar nomes camelCase na query quando a coluna real contém espaços/acentos.
- Criar migration dependente de tabela que pode não existir sem verificar a ordem histórica.
- Ocultar erro do Supabase e deixar optimistic state divergente do banco.
- Alterar políticas RLS existentes sem entender vendedor, gerente, admin e tenant.
- Tratar falha de migration/schema cache como sucesso silencioso.

## Critérios de aceite

- Transferência confirmada toca uma vez; falha ou ausência de mudança não toca.
- Vendedor destinatário ouve `lead-assigned.mp3` uma vez quando um novo lead é atribuído a ele, sem som no carregamento inicial e sem repetição em updates comuns.
- Venda confirmada mostra “Parabéns pela venda!” por 5 segundos, com o carro fiel à referência atravessando da direita para a esquerda.
- Motor começa em 11s e dinheiro começa em 5s; ambos tocam juntos e param após 5 segundos.
- Observação mostra último autor e data/hora persistidos.
- Logs gerais exibem ações do client e de updates externos cobertos pelos triggers.
- Histórico de movimentações possui scroll interno e não aumenta indefinidamente o drawer.
- Loading de carro aparece nas telas principais e é acessível.
- Nenhum caminho consegue persistir estágio fechado com nome vazio ou valor menor/igual a zero.
- Modal permite corrigir dados e conclui a movimentação sem estado intermediário incorreto.
- Estoque abre mostrando somente disponíveis e permite consultar/alterar os três status.
- Erros de banco ficam visíveis e a UI continua consistente.
- Migrations são reaplicáveis, RLS permanece segura, testes/type-check/build passam.

## Formato da entrega

Ao finalizar, informe objetivamente:

- o que foi implementado por requisito;
- migrations criadas e como aplicá-las;
- testes/comandos executados e resultados;
- arquivos principais alterados;
- limitações reais ou validações manuais pendentes;
- link para qualquer documentação/prompt produzido.
