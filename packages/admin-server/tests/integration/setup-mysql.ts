import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { MikroORM, EntityManager } from '@mikro-orm/mysql';
import { getOrm, closeOrm } from '../../src/db/orm.js';
import { TestCase } from '../../src/entities/test-case.entity.js';
import { Deployment } from '../../src/entities/deployment.entity.js';
import { TestFile } from '../../src/entities/test-file.entity.js';
import { TestCaseMapping } from '../../src/entities/test-case-mapping.entity.js';
import { TestRun } from '../../src/entities/test-run.entity.js';
import { TestRunItem } from '../../src/entities/test-run-item.entity.js';
import { TestEvent } from '../../src/entities/test-event.entity.js';

// Pass entities to MikroORM as class references so Vitest doesn't hit the
// `entitiesTs` glob, which the ESM loader can't parse directly under vite-node.
const ENTITIES = [
  TestCase,
  Deployment,
  TestFile,
  TestCaseMapping,
  TestRun,
  TestRunItem,
  TestEvent,
];

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

  // Ensure the container is stopped if any setup step after .start() fails;
  // otherwise the test's beforeAll throws and afterAll never runs.
  let orm: MikroORM;
  let em: EntityManager;
  let dbUrl: string;
  try {
    const port = container.getMappedPort(3306);
    const host = container.getHost();
    dbUrl = `mysql://platform:platform@${host}:${port}/platform_test`;
    process.env.DATABASE_URL = dbUrl;

    await closeOrm();
    orm = await getOrm({ clientUrl: dbUrl, entities: ENTITIES });
    // Vitest (esbuild) doesn't reliably read MikroORM's ts glob for migrations;
    // SchemaGenerator builds the schema directly from entity metadata. Production
    // uses migrations via `mikro-orm migration:up`.
    const generator = orm.getSchemaGenerator();
    await generator.refreshDatabase();

    em = orm.em.fork();
  } catch (err) {
    await container.stop().catch(() => {});
    throw err;
  }

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
