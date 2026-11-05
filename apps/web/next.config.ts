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
};

export default nextConfig;
