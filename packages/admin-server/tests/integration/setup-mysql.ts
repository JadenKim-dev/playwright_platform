import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { MikroORM, EntityManager } from '@mikro-orm/mysql';
import { getOrm, closeOrm } from '../../src/db/orm.js';

export interface MysqlHarness {
  container: StartedTestContainer;
  orm: MikroORM;
  em: EntityManager;
  dbUrl: string;
  reset: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function startMysqlHarness(): Promise<MysqlHarness> {
  const container = await new GenericContainer('mysql:8.0')
    .withEnvironment({
      MYSQL_ROOT_PASSWORD: 'root',
      MYSQL_USER: 'platform',
      MYSQL_PASSWORD: 'platform',
      MYSQL_DATABASE: 'platform_test',
    })
    .withCommand([
      '--default-authentication-plugin=caching_sha2_password',
      '--character-set-server=utf8mb4',
      '--default-time-zone=+00:00',
    ])
    .withExposedPorts(3306)
    .withWaitStrategy(Wait.forLogMessage(/ready for connections.*port: 3306/, 2))
    .withStartupTimeout(120_000)
    .start();

  const port = container.getMappedPort(3306);
  const host = container.getHost();
  const dbUrl = `mysql://platform:platform@${host}:${port}/platform_test`;
  process.env.DATABASE_URL = dbUrl;

  await closeOrm();
  const orm = await getOrm({ clientUrl: dbUrl });
  // Vitest (esbuild) doesn't reliably read MikroORM's ts glob for migrations;
  // SchemaGenerator builds the schema directly from entity metadata. Production
  // uses migrations via `mikro-orm migration:up`.
  const generator = orm.getSchemaGenerator();
  await generator.refreshDatabase();

  const em = orm.em.fork();

  return {
    container,
    orm,
    em,
    dbUrl,
    async reset() {
      const conn = orm.em.getConnection();
      await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
      const tables = [
        'test_events',
        'test_run_items',
        'test_runs',
        'test_case_mappings',
        'test_files',
        'deployments',
        'test_cases',
      ];
      for (const t of tables) {
        await conn.execute(`TRUNCATE TABLE \`${t}\``);
      }
      await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    },
    async stop() {
      await closeOrm();
      await container.stop();
    },
  };
}
