import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // NOTE: `output: 'standalone'` is disabled because Next.js 16 Turbopack does
  // not yet emit the standalone bundle. The Cloud Run image currently ships
  // the full node_modules + .next tree. Re-enable once Turbopack supports it.
  experimental: {
    optimizePackageImports: ['lucide-react', '@phosphor-icons/react'],
  },
};

export default nextConfig;
