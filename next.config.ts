import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // NOTE: `output: 'standalone'` is disabled because Next.js 16 Turbopack does
  // not yet emit the standalone bundle. The Cloud Run image currently ships
  // the full node_modules + .next tree. Re-enable once Turbopack supports it.
  experimental: {
    optimizePackageImports: ['lucide-react', '@phosphor-icons/react'],
  },
  async headers() {
    // Conservative baseline security headers. Avoid CSP here — the app loads
    // Mapbox/maplibre tiles, Firebase Auth popups, and inline styles from
    // three.js; a strict CSP would need a full allowlist audit first.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
