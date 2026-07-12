/** @type {import('next').NextConfig} */

// Applied to every response. A strict Content-Security-Policy is intentionally
// not set here yet — it needs per-connection allowances (Firebase, Gemini,
// AssemblyAI websockets, Font Awesome CDN) and should be rolled out in
// report-only mode first. See README "Production checklist".
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Microphone is required for the live interview; everything else is off.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
