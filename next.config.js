/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  },
  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {
    // Path alias is handled by tsconfig.json paths
  },
};

module.exports = nextConfig;

