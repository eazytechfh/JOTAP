# Onboarding de um novo cliente

Passo a passo para entregar o EazyClick CRM a um novo cliente: duplicar o
código, criar a infraestrutura própria dele (Supabase + Vercel), e deixar o
CRM pronto para uso.

## 1. Duplicar o repositório no GitHub

Crie um novo repositório a partir do template EazyClick para o cliente. O
repositório duplicado já vem com os scripts de onboarding (`scripts/setup-sql.js`,
`scripts/create-admin.js`) — não é preciso copiar nada manualmente.

## 2. Criar o projeto no Supabase

Crie uma conta/projeto novo no [supabase.com](https://supabase.com) para o
cliente. Guarde a região escolhida (ex: `us-west-2`) — vai precisar dela no
passo 4.

## 3. Resetar a senha do banco

Em **Settings → Database → Reset database password**, gere uma senha nova.

> ⚠️ **Evite os caracteres `@`, `#`, `/` na senha.** Eles têm significado
> especial dentro de uma connection string (`postgresql://usuario:senha@host/...`)
> e quebram o parsing se aparecerem na senha sem estarem codificados. Se o
> gerador automático do Supabase incluir algum desses caracteres, gere de novo.

## 4. Copiar a connection string (Session pooler)

No painel do projeto, clique em **Connect** (topo da página) → aba **Direct**
→ em "Connection Method" escolha **Session pooler** → copie a URI.

> ⚠️ **Não use "Direct connection".** Ela resolve em IPv6 por padrão, e a
> maioria das redes (incluindo conexões domésticas comuns) não tem saída IPv6
> funcional — a conexão trava com `ETIMEDOUT`. O Session pooler usa um host
> `aws-X-regiao.pooler.supabase.com` com IPv4, e funciona em qualquer rede.

A string final tem este formato (substitua `SUA_SENHA`):

```
postgresql://postgres.<ref-do-projeto>:SUA_SENHA@aws-X-regiao.pooler.supabase.com:5432/postgres
```

## 5. Rodar o setup SQL

Na pasta do repositório duplicado:

```powershell
npm install
npm run setup:sql -- "postgresql://postgres.xxxx:SUA_SENHA@aws-X-regiao.pooler.supabase.com:5432/postgres"
```

Isso aplica todas as migrations de `supabase/migrations/` de uma vez (tabelas
`profiles`, `app_settings`, `etiquetas`, triggers de criação de usuário, RLS,
bucket de logo etc.). O script é idempotente — pode rodar de novo no mesmo
banco sem duplicar nada caso precise reaplicar.

## 6. Copiar as chaves de API do projeto

Em **Settings → API**, copie:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (nunca expor ao navegador)

## 7. Criar o projeto na Vercel e configurar as variáveis de ambiente

Importe o repositório do cliente na Vercel e configure as env vars:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | do passo 6 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | do passo 6 |
| `SUPABASE_SERVICE_ROLE_KEY` | do passo 6 |
| `UAZAPI_BASE_URL` | `https://eazytech.uazapi.com` (fixo) |

## 8. Fazer o deploy

Publique o projeto na Vercel. O CRM já deve carregar a tela de login.

## 9. Criar o primeiro usuário admin_master

`admin_master` é uma role oculta (senha padrão dos desenvolvedores) que não
pode ser criada pela própria UI do CRM — só por este script, rodado localmente
com o `.env.local` apontando para o projeto do cliente (mesmas chaves do
passo 6):

```powershell
npm run setup:admin -- "admin@cliente.com" "SenhaProvisoria123" "Nome do Admin"
```

## 10. Logar no CRM publicado

Acesse a URL da Vercel e faça login com o e-mail/senha criados no passo 9.

## 11. Configurar uazapi e a marca do cliente

Já logado como admin_master, em **Configurações**:

- **Credenciais**: cole o token da instância uazapi (criada separadamente
  pela equipe na conta uazapi) e clique em "Conectar WhatsApp" para gerar o
  QR code.
- **Aparência**: suba a logo do cliente e ajuste as cores do sistema
  (primária, secundária, texto, fundo).

CRM pronto para o cliente usar.

---

## Pontos de atenção (aprendidos na prática)

- **Senha do banco sem `@`, `#`, `/`** — esses caracteres quebram a connection
  string se não forem codificados.
- **Sempre "Session pooler", nunca "Direct connection"** — a conexão direta
  usa IPv6 por padrão e trava em redes comuns.
- **Copie a string exata do painel do Supabase** — não digite o host/usuário
  de cabeça; o formato (`aws-0-...` vs `aws-1-...`, região exata) varia por
  projeto e não é adivinhável.
