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
};

export default nextConfig;
