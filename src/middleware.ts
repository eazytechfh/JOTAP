import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Decisão: rotas /api/* NÃO são bloqueadas aqui pelo middleware. Cada API route já valida a
// sessão internamente via supabase server client (ver src/app/api/**), retornando 401/403
// quando necessário. Bloquear /api/* genericamente no middleware impediria, por exemplo, que a
// própria rota decida responder com um JSON de erro apropriado em vez de um redirect HTML.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data } = await supabase.auth.getSession();
  const isAuthenticated = !!data.session;

  const { pathname } = request.nextUrl;

  // /produtos é o chat público de cadastro de produtos usado por clientes (sem login).
  // /api/* fica de fora do bloqueio aqui (ver comentário no topo do arquivo): cada rota valida
  // sua própria sessão, e o chat público precisa chamar /api/produtos/webhook sem estar logado.
  const isPublicRoute =
    pathname === '/login' || pathname.startsWith('/produtos') || pathname.startsWith('/api/');

  if (!isAuthenticated && !isPublicRoute) {
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthenticated) {
    // Vendedor não tem acesso ao Dashboard (só vê os próprios leads atribuídos). Bloqueado aqui
    // também no middleware, e não só escondendo o item da sidebar, para cobrir acesso direto à URL.
    const { data: profileData } = await supabase
      .from('profiles')
      .select('cargo')
      .eq('id', data.session!.user.id)
      .single();
    const cargo = (profileData as { cargo: string } | null)?.cargo ?? 'vendedor';
    const homeRoute = cargo === 'vendedor' ? '/leads' : '/dashboard';

    if (pathname === '/login') {
      return NextResponse.redirect(new URL(homeRoute, request.url));
    }

    if (cargo === 'vendedor' && pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/leads', request.url));
    }
  }

  return response;
}

export const config = {
  // Aplica o middleware a tudo, exceto arquivos estáticos do Next (_next/static, _next/image),
  // o favicon e public/effects/* (áudios/imagens de efeitos, sem dado sensível). /effects precisa
  // ficar fora: o otimizador de imagem do Next faz um fetch interno servidor-a-servidor para
  // imagens locais (ex.: o carro da celebração de venda) sem repassar o cookie de sessão; se o
  // middleware exigir auth nesse caminho, o fetch interno cai no redirect para /login (HTML) e o
  // otimizador falha com "resource isn't a valid image". /api/* permanece coberto
  // intencionalmente (não checamos sessão de cookie ali, mas isso não causa problema pois cada
  // API route valida sessão por conta própria).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|effects/).*)'],
};
