import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // @graphpay/config reads its two JSON files at run time (readFileSync next to
  // index.mjs). The file trace does not follow that read, so every function
  // bundle carries them explicitly; without this a route fails on Vercel only.
  outputFileTracingIncludes: {
    '/**': ['../../packages/config/graphpay.config.json', '../../packages/config/story.json'],
  },
  // Local design work only: GRAPHPAY_DEV_API=<the production domain> sends this dev server's /api
  // calls to the live site, so the stage can be built without any server key on this machine.
  ...(process.env.NODE_ENV === 'development' && process.env.GRAPHPAY_DEV_API
    ? { rewrites: async () => ({ beforeFiles: [{ source: '/api/:path*', destination: `${process.env.GRAPHPAY_DEV_API}/api/:path*` }], afterFiles: [], fallback: [] }) }
    : {}),
};

export default nextConfig;
