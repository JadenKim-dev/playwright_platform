/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@mikro-orm/core', '@mikro-orm/mysql'],
  },
};

export default nextConfig;
