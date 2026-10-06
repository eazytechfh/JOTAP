# Changelog

## 2026-07-03 - Ajuste de scroll do Pipeline

### Contexto

A tela de Pipeline estava permitindo que a página inteira rolasse verticalmente. Com isso, a barra lateral esquerda acompanhava o scroll visual da área principal, quando o comportamento esperado era manter a navegação fixa e permitir scroll apenas nas etapas do funil.

### Alterações realizadas

- Ajustado o layout autenticado em `src/app/(app)/layout.tsx` para ocupar exatamente a altura da viewport com `h-screen` e impedir overflow externo com `overflow-hidden`.
- Adicionados `min-h-0` e `min-w-0` ao `<main>` para que o conteúdo interno possa controlar o próprio scroll sem empurrar a sidebar.
- Ajustada a tela `src/app/(app)/pipeline/page.tsx` para usar layout flex de altura cheia.
- Ajustado o container das etapas do Pipeline para ter scroll horizontal próprio.
- Ajustadas as colunas do Pipeline para terem altura limitada pelo viewport e scroll vertical interno na lista de cards.

### Resultado esperado

- A sidebar esquerda permanece estática.
- As etapas do Pipeline rolam horizontalmente quando não couberem na largura da tela.
- Os cards dentro de cada etapa rolam verticalmente dentro da própria coluna.
- O layout evita scroll global desnecessário na tela de Pipeline.

### Validação

- Executado `npm run build` com sucesso.
- Servidor local testado em `http://127.0.0.1:3000/login`, retornando `200 OK`.
