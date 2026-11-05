import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // @graphpay/config reads its two JSON files at run time; the file trace does not follow
  // that read, so every function bundle carries them (the checkout ABI too).
  outputFileTracingIncludes: {
    '/**': ['../../packages/config/graphpay.config.json', '../../packages/config/story.json', '../../packages/contracts/abi/GraphPayCheckout.json'],
  },
};

export default nextConfig;
