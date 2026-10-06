# EazyClick CRM

CRM para concessionárias de veículos, construído com Next.js (App Router), TypeScript, Tailwind CSS e Supabase.

> Para entregar o CRM a um **novo cliente** (duplicar repositório, criar Supabase, deploy na Vercel etc.), siga o passo a passo completo em [`docs/ONBOARDING.md`](docs/ONBOARDING.md).

## Configuração (ambiente local)

1. Copie o arquivo de exemplo de variáveis de ambiente:

   ```
   cp .env.local.example .env.local
   ```

   Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` com os valores do seu projeto Supabase, e `UAZAPI_BASE_URL` com a URL da instância uazapi (padrão: `https://eazytech.uazapi.com`).

2. Aplique todas as migrations SQL no seu projeto Supabase com um único comando (veja [`docs/ONBOARDING.md`](docs/ONBOARDING.md) para como pegar a connection string certa — use o **Session pooler**, não a conexão direta):

   ```
   npm run setup:sql -- "postgresql://postgres.xxxx:SENHA@aws-X-regiao.pooler.supabase.com:5432/postgres"
   ```

   Alternativa manual: colar cada arquivo de `supabase/migrations/` (em ordem) no SQL Editor do Supabase Dashboard.

3. Crie o primeiro usuário `admin_master`:

   ```
   npm run setup:admin -- "admin@cliente.com" "SenhaProvisoria123" "Nome do Admin"
   ```

4. Instale as dependências e rode o servidor de desenvolvimento:

   ```
   npm install
   npm run dev
   ```

## Build de produção

```
npm run build
npm run start
```

## Redistribuição de leads e tema

Após aplicar `supabase/migrations/0024_redistribuir_leads.sql`, administradores e gerentes podem
selecionar leads individualmente ou selecionar todos os resultados dos filtros e usar
**Redistribuir igualmente**. A operação considera apenas vendedores ativos e é atômica.

O modo claro/escuro fica no menu do usuário na barra lateral. A preferência é salva no navegador;
quando ainda não existe preferência, o CRM acompanha o tema do sistema operacional.
