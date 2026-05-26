/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Production API URL — RAG server via nginx path routing on the n8n domain
    NEXT_PUBLIC_API_URL: 'https://n8n.mdtahsinrahman.com/api',
  },
};

export default nextConfig;
