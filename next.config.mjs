/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // ATENÇÃO / RISCO DE SEGURANÇA:
    // O wildcard "**" abaixo permite que o componente <Image> do Next.js otimize/exiba
    // imagens de QUALQUER hostname HTTPS. Isso é conveniente em desenvolvimento (já que os
    // veículos do estoque podem vir de URLs variadas, CDNs diferentes, links colados manualmente
    // no banco etc.), mas em produção isso abre a porta para:
    //  - SSRF / abuso do otimizador de imagens do Next.js como proxy para buscar qualquer URL;
    //  - exibição de conteúdo de domínios não confiáveis dentro do app.
    // O ideal em produção é restringir remotePatterns para uma whitelist explícita dos domínios
    // reais usados pela concessionária (ex: CDN de fotos da loja, bucket do Supabase Storage,
    // domínio da revenda, etc.) em vez de usar "**".
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
