/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Production API URL — RAG server via nginx path routing on the n8n domain
    NEXT_PUBLIC_API_URL: 'https://n8n.mdtahsinrahman.com/api',
    // Same URL used by knowledge-base page (was using a separate var pointing to localhost)
    NEXT_PUBLIC_FASTAPI_URL: 'https://n8n.mdtahsinrahman.com/api',
    // RAG_API_SECRET is intentionally NOT listed here — it must never be in the
    // client bundle. It is read server-side only via app/api/rag/* proxy routes.
    // Set it in Vercel: Settings → Environment Variables → RAG_API_SECRET (no NEXT_PUBLIC_ prefix)
  },

  // ── Security headers — applied to every response [F1] ──────────────────
  async headers() {
    // Demo build frames its own pages (the /mobile phone view iframes the inbox),
    // so it needs same-origin framing. Production stays fully locked (DENY / 'none')
    // to prevent clickjacking of the real admin portal. Gated by NEXT_PUBLIC_DEMO_MODE.
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
    const frameAncestors = isDemo ? "frame-ancestors 'self'" : "frame-ancestors 'none'"
    const xFrameOptions = isDemo ? 'SAMEORIGIN' : 'DENY'
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // Locks resources to same origin + Supabase + the RAG API domain.
            // 'unsafe-inline' required by Next.js inline scripts/styles in production.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // unsafe-eval needed by Next.js
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://n8n.mdtahsinrahman.com",
              frameAncestors,
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: xFrameOptions,
          },
        ],
      },
    ]
  },
};

export default nextConfig;
