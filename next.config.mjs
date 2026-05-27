/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Production API URL — RAG server via nginx path routing on the n8n domain
    NEXT_PUBLIC_API_URL: 'https://n8n.mdtahsinrahman.com/api',
    // Same URL used by knowledge-base page (was using a separate var pointing to localhost)
    NEXT_PUBLIC_FASTAPI_URL: 'https://n8n.mdtahsinrahman.com/api',
    // API secret — required by all protected RAG server endpoints.
    // This appears in the client bundle (unavoidable for 'use client' pages).
    // For a future improvement, move sensitive calls to Next.js API routes.
    // Set this in Vercel: Settings → Environment Variables → NEXT_PUBLIC_RAG_API_SECRET
    NEXT_PUBLIC_RAG_API_SECRET: process.env.NEXT_PUBLIC_RAG_API_SECRET || '',
  },

  // ── Security headers — applied to every response [F1] ──────────────────
  async headers() {
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
              "frame-ancestors 'none'",
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
            value: 'DENY',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
