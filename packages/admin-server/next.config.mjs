/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // MikroORM and its transitive driver chain (knex, mysql2) must run as
    // server externals; webpack cannot bundle their dynamic requires.
    serverComponentsExternalPackages: [
      '@mikro-orm/core',
      '@mikro-orm/mysql',
      '@mikro-orm/migrations',
      '@mikro-orm/reflection',
      '@mikro-orm/knex',
      'knex',
      'mysql2',
    ],
  },
};

export default nextConfig;
