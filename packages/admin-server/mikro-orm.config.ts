import { defineConfig } from '@mikro-orm/mysql';
import { Migrator } from '@mikro-orm/migrations';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

const url =
  process.env.DATABASE_URL ?? 'mysql://platform:platform@localhost:3306/platform';

export default defineConfig({
  clientUrl: url,
  entities: ['./dist/entities/*.entity.js'],
  entitiesTs: ['./src/entities/*.entity.ts'],
  metadataProvider: TsMorphMetadataProvider,
  migrations: {
    path: './dist/db/migrations',
    pathTs: './src/db/migrations',
    snapshot: false,
    transactional: true,
    disableForeignKeys: false,
  },
  extensions: [Migrator],
  forceUtcTimezone: true,
  debug: false,
});
