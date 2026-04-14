# Phase 3a: `@platform/admin-server` — Entities + Services + Public REST API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Convention update (post-implementation):** Unit tests are now co-located with their source file under `src/services/*.service.test.ts` instead of `tests/unit/`. Only integration tests remain under `tests/integration/`. Historical paths below (`tests/unit/...`) reflect the original plan; the current layout, `vitest.config.ts` include pattern, and `package.json` test scripts have been updated accordingly.

**Goal:** Next.js 기반 admin-server 패키지를 만들고, 7개 MikroORM 엔티티 + 마이그레이션 + 비즈니스 서비스 + 공개 REST API(브라우저용)까지 동작시킨다. 외부 의존(RabbitMQ publisher, MinIO, deploy-server)은 인터페이스로 추상화하고 stub 구현을 주입해 단독 실행 가능한 상태를 만든다. 실제 큐/스토리지 연결과 internal API, UI는 Phase 3b에서 다룬다.

**Architecture:**
- `packages/admin-server`: Next.js 14 (App Router) + MikroORM 6 + MySQL 8.0
- 4-layer: `app/api/*` (HTTP I/O) → `services/*` (트랜잭션 경계, 비즈니스 로직) → `repositories/*` (쿼리 캡슐화) → `entities/*` (ORM 매핑)
- 외부 의존은 인터페이스로 격리: `RunQueuePublisher`, `ObjectStorageClient`, `DeployTrigger`. Phase 3a에서는 in-memory/no-op stub으로 주입, Phase 3b에서 실 구현으로 교체.
- DI는 가벼운 module-scope factory (`getAdminContainer()`)로 시작 — Next.js 라우트는 매 요청마다 컨테이너에서 서비스를 꺼내 EntityManager fork 후 사용.
- 테스트:
  - 서비스 단위 테스트: repository/외부 의존 mock
  - API 통합 테스트: testcontainers로 일회용 MySQL 컨테이너 띄우고 마이그레이션 + 실제 fetch 호출로 핸들러 검증

**Tech Stack:** Next.js 14 (App Router, Node runtime), MikroORM 6 (`@mikro-orm/core`, `@mikro-orm/mysql`, `@mikro-orm/migrations`), `mysql2`, Vitest, `testcontainers`, `@platform/shared`(workspace:*).

---

## 파일 구조

Phase 3a에서 생성/수정하는 파일:

**패키지 설정**
- Create: `packages/admin-server/package.json`
- Create: `packages/admin-server/tsconfig.json`
- Create: `packages/admin-server/next.config.mjs`
- Create: `packages/admin-server/vitest.config.ts`
- Create: `packages/admin-server/.env.test` — 통합 테스트용
- Create: `packages/admin-server/src/index.ts` — 엔트리 (placeholder)

**MikroORM 설정 + 엔티티**
- Create: `packages/admin-server/mikro-orm.config.ts` — CLI/런타임 공용 설정
- Create: `packages/admin-server/src/db/orm.ts` — `getOrm()` (싱글톤)
- Create: `packages/admin-server/src/entities/test-case.entity.ts`
- Create: `packages/admin-server/src/entities/deployment.entity.ts`
- Create: `packages/admin-server/src/entities/test-file.entity.ts`
- Create: `packages/admin-server/src/entities/test-case-mapping.entity.ts`
- Create: `packages/admin-server/src/entities/test-run.entity.ts`
- Create: `packages/admin-server/src/entities/test-run-item.entity.ts`
- Create: `packages/admin-server/src/entities/test-event.entity.ts`
- Create: `packages/admin-server/src/entities/index.ts`
- Create: `packages/admin-server/src/db/migrations/Migration00000000000001.ts` — 초기 스키마

**Repositories**
- Create: `packages/admin-server/src/repositories/test-case.repository.ts`
- Create: `packages/admin-server/src/repositories/deployment.repository.ts`
- Create: `packages/admin-server/src/repositories/test-file.repository.ts`
- Create: `packages/admin-server/src/repositories/test-case-mapping.repository.ts`
- Create: `packages/admin-server/src/repositories/test-run.repository.ts`
- Create: `packages/admin-server/src/repositories/test-run-item.repository.ts`
- Create: `packages/admin-server/src/repositories/test-event.repository.ts`

**외부 의존 인터페이스 + stub**
- Create: `packages/admin-server/src/queue/run-queue-publisher.ts` — interface + `NoopRunQueuePublisher`
- Create: `packages/admin-server/src/storage/object-storage-client.ts` — interface + `NoopObjectStorageClient`
- Create: `packages/admin-server/src/deploy/deploy-trigger.ts` — interface + `NoopDeployTrigger`

**Services**
- Create: `packages/admin-server/src/services/test-case.service.ts`
- Create: `packages/admin-server/src/services/deployment.service.ts`
- Create: `packages/admin-server/src/services/run.service.ts`
- Create: `packages/admin-server/src/services/event-ingest.service.ts`
- Create: `packages/admin-server/src/services/mappers.ts` — entity → DTO 변환 헬퍼

**DI 컨테이너**
- Create: `packages/admin-server/src/container.ts` — `getAdminContainer()`

**공개 REST API (Next.js App Router)**
- Create: `packages/admin-server/src/app/api/test-cases/route.ts` — GET 목록
- Create: `packages/admin-server/src/app/api/test-cases/[id]/route.ts` — GET 상세, PATCH 수정
- Create: `packages/admin-server/src/app/api/test-cases/[id]/runs/route.ts` — GET 해당 TC 실행 이력
- Create: `packages/admin-server/src/app/api/runnable-test-cases/route.ts` — GET 실행 가능 목록
- Create: `packages/admin-server/src/app/api/deployments/route.ts` — GET 목록, POST 트리거
- Create: `packages/admin-server/src/app/api/deployments/[id]/route.ts` — GET 상세
- Create: `packages/admin-server/src/app/api/deployments/[id]/test-files/route.ts` — GET 번들 파일 목록
- Create: `packages/admin-server/src/app/api/runs/route.ts` — GET 목록, POST 트리거
- Create: `packages/admin-server/src/app/api/runs/[id]/route.ts` — GET 상세 (items 포함)
- Create: `packages/admin-server/src/app/api/runs/[id]/report/route.ts` — GET 리포트 URL (storage stub)
- Create: `packages/admin-server/src/app/api/_lib/error-handler.ts` — `ApiError` 클래스 + try/catch wrapper

**테스트 — 서비스 단위 테스트 (mock 기반)**
- Create: `packages/admin-server/tests/unit/test-case.service.test.ts`
- Create: `packages/admin-server/tests/unit/deployment.service.test.ts`
- Create: `packages/admin-server/tests/unit/run.service.test.ts`
- Create: `packages/admin-server/tests/unit/event-ingest.service.test.ts`

**테스트 — API 통합 테스트 (testcontainers MySQL)**
- Create: `packages/admin-server/tests/integration/setup-mysql.ts` — testcontainers 헬퍼
- Create: `packages/admin-server/tests/integration/test-cases.api.test.ts`
- Create: `packages/admin-server/tests/integration/deployments.api.test.ts`
- Create: `packages/admin-server/tests/integration/runs.api.test.ts`

**루트 수정**
- Modify: 루트 `vitest.config.ts` — admin-server 통합 테스트는 별도 timeout 필요 (testcontainers 기동 시간)
- Modify: 루트 `README.md` — Phase 3a 빌드/테스트 명령 추가

---

## API ↔ Service ↔ Repository 매핑 표

| Endpoint | Service Method | 주요 Repo 호출 |
|---|---|---|
| `GET /api/test-cases?q&tag&active_only&page` | `TestCaseService.list()` | `TestCaseRepository.listWithFilter()` + `DeploymentRepository.findLatestSuccess()` + `TestCaseMappingRepository.findByDeploymentId()` |
| `GET /api/test-cases/:id` | `TestCaseService.getById()` | `TestCaseRepository.findById()` + `DeploymentRepository.findLatestSuccess()` + `TestCaseMappingRepository.findByDeploymentId()` |
| `PATCH /api/test-cases/:id` | `TestCaseService.patch()` | `TestCaseRepository.findById()` + `em.flush()` |
| `GET /api/test-cases/:id/runs` | `RunService.listRunsForTestCase()` | `TestRunItemRepository.findByTestCaseId()` + `TestRunRepository.findByIds()` |
| `GET /api/runnable-test-cases` | `TestCaseService.listRunnable()` | `DeploymentRepository.findLatestSuccess()` + `TestCaseMappingRepository.findByDeploymentId()` |
| `GET /api/deployments?status&page` | `DeploymentService.list()` | `DeploymentRepository.list()` |
| `POST /api/deployments` | `DeploymentService.create()` | `DeploymentRepository.persist()` + `DeployTrigger.trigger()` (stub) |
| `GET /api/deployments/:id` | `DeploymentService.getById()` | `DeploymentRepository.findById()` |
| `GET /api/deployments/:id/test-files` | `DeploymentService.listTestFiles()` | `TestFileRepository.findByDeploymentId()` |
| `POST /api/runs` | `RunService.create()` | `DeploymentRepository.findLatestSuccess()` + `TestCaseRepository.findByIds()` + `TestCaseMappingRepository.findByDeploymentAndTcs()` + persist Run + Items + `RunQueuePublisher.publish()` (stub) |
| `GET /api/runs?page` | `RunService.list()` | `TestRunRepository.list()` |
| `GET /api/runs/:id` | `RunService.getById()` | `TestRunRepository.findById()` + `TestRunItemRepository.findByRunId()` |
| `GET /api/runs/:id/report` | `RunService.getReportUrl()` | `TestRunRepository.findById()` + `ObjectStorageClient.presignedGetUrl()` (stub) |

---

### Task 1: `packages/admin-server` 패키지 골격

**Files:**
- Create: `packages/admin-server/package.json`
- Create: `packages/admin-server/tsconfig.json`
- Create: `packages/admin-server/next.config.mjs`
- Create: `packages/admin-server/vitest.config.ts`
- Create: `packages/admin-server/.env.test`
- Create: `packages/admin-server/src/index.ts`

- [ ] **Step 1: `packages/admin-server/package.json` 작성**

```json
{
  "name": "@platform/admin-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "lint": "next lint",
    "mikro-orm": "mikro-orm --config ./mikro-orm.config.ts"
  },
  "dependencies": {
    "@platform/shared": "workspace:*",
    "@mikro-orm/core": "^6.4.0",
    "@mikro-orm/mysql": "^6.4.0",
    "@mikro-orm/migrations": "^6.4.0",
    "@mikro-orm/reflection": "^6.4.0",
    "mysql2": "^3.11.0",
    "next": "14.2.18",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@mikro-orm/cli": "^6.4.0",
    "@types/react": "18.3.12",
    "@types/react-dom": "18.3.1",
    "@types/uuid": "^10.0.0",
    "eslint-config-next": "14.2.18",
    "testcontainers": "^10.13.2"
  }
}
```

- [ ] **Step 2: `packages/admin-server/tsconfig.json` 작성**

Next.js 빌드와 MikroORM 데코레이터 + 통합 테스트가 모두 통과해야 한다.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "./dist",
    "rootDir": ".",
    "incremental": true,
    "noEmit": true,
    "allowJs": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    "tests/**/*.ts",
    "mikro-orm.config.ts",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules", "dist", ".next"]
}
```

> 주의: 루트 `tsconfig.base.json`은 `module: NodeNext`이므로 admin-server는 `module/moduleResolution`을 Next.js용으로 override한다. MikroORM 데코레이터는 `experimentalDecorators` + `emitDecoratorMetadata`(base에 이미 있음)에 의존한다.

- [ ] **Step 3: `packages/admin-server/next.config.mjs` 작성**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@mikro-orm/core', '@mikro-orm/mysql'],
  },
};

export default nextConfig;
```

- [ ] **Step 4: `packages/admin-server/vitest.config.ts` 작성**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
```

> testcontainers는 Docker 기동에 시간이 걸린다. integration 테스트 한 파일 안에서 컨테이너를 한 번만 띄우기 위해 `singleFork: true`로 워커를 직렬화한다.

- [ ] **Step 5: `packages/admin-server/.env.test` 작성**

```
INTERNAL_API_TOKEN=test-internal-token
ADMIN_URL=http://localhost:3000
DEPLOY_URL=http://localhost:4000
MINIO_BUCKET=test-platform
NODE_ENV=test
```

- [ ] **Step 6: `packages/admin-server/src/index.ts` 작성**

```ts
// Next.js가 엔트리이므로 라이브러리 export는 비워둔다.
export {};
```

- [ ] **Step 7: 의존성 설치**

Run: `pnpm install`
Expected: `@platform/admin-server` 패키지가 workspace에 추가되고 의존성 설치 성공.

- [ ] **Step 8: 커밋**

```bash
git add packages/admin-server pnpm-lock.yaml
git commit -m "feat(admin-server): scaffold Next.js + MikroORM package"
```

---

### Task 2: MikroORM config + EntityManager 싱글톤

**Files:**
- Create: `packages/admin-server/mikro-orm.config.ts`
- Create: `packages/admin-server/src/db/orm.ts`

- [ ] **Step 1: `packages/admin-server/mikro-orm.config.ts` 작성**

```ts
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
```

- [ ] **Step 2: `packages/admin-server/src/db/orm.ts` 작성**

`getOrm()`은 프로세스당 한 번 초기화하는 싱글톤. 통합 테스트에서는 매 setup마다 `closeOrm()` 후 새 URL로 다시 호출 가능해야 한다.

```ts
import { MikroORM } from '@mikro-orm/mysql';
import config from '../../mikro-orm.config.js';

let ormPromise: Promise<MikroORM> | null = null;

export function getOrm(overrides?: { clientUrl?: string }): Promise<MikroORM> {
  if (!ormPromise) {
    ormPromise = MikroORM.init({
      ...config,
      ...(overrides?.clientUrl ? { clientUrl: overrides.clientUrl } : {}),
    });
  }
  return ormPromise;
}

export async function closeOrm(): Promise<void> {
  if (!ormPromise) return;
  const orm = await ormPromise;
  await orm.close(true);
  ormPromise = null;
}
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter @platform/admin-server exec tsc --noEmit -p tsconfig.json`
Expected: 타입 에러 없음 (엔티티는 다음 Task에서 추가, 빈 glob은 OK).

- [ ] **Step 4: 커밋**

```bash
git add packages/admin-server/mikro-orm.config.ts packages/admin-server/src/db
git commit -m "feat(admin-server): add MikroORM config and orm singleton"
```

---

### Task 3: TestCase 엔티티

**Files:**
- Create: `packages/admin-server/src/entities/test-case.entity.ts`
- Create: `packages/admin-server/src/entities/index.ts`

- [ ] **Step 1: `test-case.entity.ts` 작성**

스펙 §4.1 `test_cases`. PK는 "TC-001" 같은 문자열, `params/expected/tags`는 JSON 컬럼.

```ts
import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'test_cases' })
export class TestCase {
  @PrimaryKey({ type: 'string', length: 64 })
  id!: string;

  @Property({ type: 'string', length: 255 })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description: string | null = null;

  @Property({ type: 'json' })
  params: Record<string, unknown> = {};

  @Property({ type: 'json' })
  expected: Record<string, unknown> = {};

  @Property({ type: 'json' })
  tags: string[] = [];

  @Property({ type: 'boolean', default: false })
  @Index()
  autoCreated: boolean = false;

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  createdAt: Date = new Date();

  @Property({
    type: 'datetime',
    length: 3,
    defaultRaw: 'CURRENT_TIMESTAMP(3)',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
```

- [ ] **Step 2: `entities/index.ts` 작성**

```ts
export { TestCase } from './test-case.entity.js';
```

- [ ] **Step 3: 커밋**

```bash
git add packages/admin-server/src/entities
git commit -m "feat(admin-server): add TestCase entity"
```

---

### Task 4: Deployment + TestFile + TestCaseMapping 엔티티

**Files:**
- Create: `packages/admin-server/src/entities/deployment.entity.ts`
- Create: `packages/admin-server/src/entities/test-file.entity.ts`
- Create: `packages/admin-server/src/entities/test-case-mapping.entity.ts`
- Modify: `packages/admin-server/src/entities/index.ts`

- [ ] **Step 1: `deployment.entity.ts` 작성**

```ts
import { Entity, PrimaryKey, Property, Enum, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { DeploymentStatus } from '@platform/shared';

@Entity({ tableName: 'deployments' })
export class Deployment {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @Property({ type: 'string', length: 255 })
  gitRef!: string;

  @Enum({ items: () => Object.values(DeploymentStatus), type: 'string' })
  @Index()
  status: DeploymentStatus = DeploymentStatus.Pending;

  @Property({ type: 'text', nullable: true })
  errorMessage: string | null = null;

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  startedAt: Date = new Date();

  @Property({ type: 'datetime', length: 3, nullable: true })
  finishedAt: Date | null = null;
}
```

- [ ] **Step 2: `test-file.entity.ts` 작성**

```ts
import { Entity, PrimaryKey, Property, ManyToOne, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { Deployment } from './deployment.entity.js';

@Entity({ tableName: 'test_files' })
@Index({ properties: ['deployment'] })
export class TestFile {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @ManyToOne(() => Deployment, { fieldName: 'deployment_id', deleteRule: 'cascade' })
  deployment!: Deployment;

  @Property({ type: 'string', length: 512 })
  sourcePath!: string;

  @Property({ type: 'string', length: 512 })
  bundleKey!: string;

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  createdAt: Date = new Date();
}
```

- [ ] **Step 3: `test-case-mapping.entity.ts` 작성**

스펙 §4.1: UNIQUE(`deployment_id`, `test_case_id`).

```ts
import { Entity, PrimaryKey, Property, ManyToOne, Unique, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { Deployment } from './deployment.entity.js';
import { TestCase } from './test-case.entity.js';
import { TestFile } from './test-file.entity.js';

@Entity({ tableName: 'test_case_mappings' })
@Unique({ properties: ['deployment', 'testCase'] })
@Index({ properties: ['testCase'] })
export class TestCaseMapping {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @ManyToOne(() => Deployment, { fieldName: 'deployment_id', deleteRule: 'cascade' })
  deployment!: Deployment;

  @ManyToOne(() => TestCase, { fieldName: 'test_case_id', deleteRule: 'restrict' })
  testCase!: TestCase;

  @ManyToOne(() => TestFile, { fieldName: 'test_file_id', deleteRule: 'cascade' })
  testFile!: TestFile;
}
```

- [ ] **Step 4: `entities/index.ts` 갱신**

```ts
export { TestCase } from './test-case.entity.js';
export { Deployment } from './deployment.entity.js';
export { TestFile } from './test-file.entity.js';
export { TestCaseMapping } from './test-case-mapping.entity.js';
```

- [ ] **Step 5: 커밋**

```bash
git add packages/admin-server/src/entities
git commit -m "feat(admin-server): add Deployment, TestFile, TestCaseMapping entities"
```

---

### Task 5: TestRun + TestRunItem + TestEvent 엔티티

**Files:**
- Create: `packages/admin-server/src/entities/test-run.entity.ts`
- Create: `packages/admin-server/src/entities/test-run-item.entity.ts`
- Create: `packages/admin-server/src/entities/test-event.entity.ts`
- Modify: `packages/admin-server/src/entities/index.ts`

- [ ] **Step 1: `test-run.entity.ts` 작성**

```ts
import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { RunStatus } from '@platform/shared';
import { Deployment } from './deployment.entity.js';

@Entity({ tableName: 'test_runs' })
export class TestRun {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @ManyToOne(() => Deployment, { fieldName: 'deployment_id', deleteRule: 'restrict' })
  deployment!: Deployment;

  @Property({ type: 'json' })
  requestedTestCaseIds: string[] = [];

  @Enum({ items: () => Object.values(RunStatus), type: 'string' })
  @Index()
  status: RunStatus = RunStatus.Queued;

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  requestedAt: Date = new Date();

  @Property({ type: 'datetime', length: 3, nullable: true })
  startedAt: Date | null = null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  finishedAt: Date | null = null;

  @Property({ type: 'string', length: 512, nullable: true })
  playwrightReportKey: string | null = null;
}
```

- [ ] **Step 2: `test-run-item.entity.ts` 작성**

```ts
import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { RunItemStatus } from '@platform/shared';
import { TestRun } from './test-run.entity.js';
import { TestCase } from './test-case.entity.js';
import { TestFile } from './test-file.entity.js';

@Entity({ tableName: 'test_run_items' })
@Index({ properties: ['testRun'] })
@Index({ properties: ['testCase'] })
export class TestRunItem {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @ManyToOne(() => TestRun, { fieldName: 'test_run_id', deleteRule: 'cascade' })
  testRun!: TestRun;

  @ManyToOne(() => TestCase, { fieldName: 'test_case_id', deleteRule: 'restrict' })
  testCase!: TestCase;

  @ManyToOne(() => TestFile, { fieldName: 'test_file_id', deleteRule: 'restrict' })
  testFile!: TestFile;

  @Enum({ items: () => Object.values(RunItemStatus), type: 'string' })
  status: RunItemStatus = RunItemStatus.Pending;

  @Property({ type: 'integer', nullable: true })
  durationMs: number | null = null;

  @Property({ type: 'text', nullable: true })
  errorMessage: string | null = null;

  @Property({ type: 'json' })
  paramsSnapshot: Record<string, unknown> = {};

  @Property({ type: 'json' })
  expectedSnapshot: Record<string, unknown> = {};

  @Property({ type: 'datetime', length: 3, nullable: true })
  startedAt: Date | null = null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  finishedAt: Date | null = null;
}
```

- [ ] **Step 3: `test-event.entity.ts` 작성**

스펙: `id` bigint auto_increment.

```ts
import { Entity, PrimaryKey, Property, ManyToOne, Enum, Index } from '@mikro-orm/core';
import { ReporterEventType } from '@platform/shared';
import { TestRun } from './test-run.entity.js';
import { TestRunItem } from './test-run-item.entity.js';

@Entity({ tableName: 'test_events' })
@Index({ properties: ['testRun', 'id'] })
export class TestEvent {
  @PrimaryKey({ type: 'bigint', autoincrement: true })
  id!: string;

  @ManyToOne(() => TestRun, { fieldName: 'test_run_id', deleteRule: 'cascade' })
  testRun!: TestRun;

  @ManyToOne(() => TestRunItem, { fieldName: 'test_run_item_id', deleteRule: 'cascade', nullable: true })
  testRunItem: TestRunItem | null = null;

  @Enum({ items: () => Object.values(ReporterEventType), type: 'string' })
  eventType!: ReporterEventType;

  @Property({ type: 'json' })
  payload: Record<string, unknown> = {};

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  emittedAt: Date = new Date();
}
```

> MikroORM의 `bigint` 컬럼은 기본적으로 string으로 매핑된다. 정렬·비교에 영향 없음.

- [ ] **Step 4: `entities/index.ts` 갱신**

```ts
export { TestCase } from './test-case.entity.js';
export { Deployment } from './deployment.entity.js';
export { TestFile } from './test-file.entity.js';
export { TestCaseMapping } from './test-case-mapping.entity.js';
export { TestRun } from './test-run.entity.js';
export { TestRunItem } from './test-run-item.entity.js';
export { TestEvent } from './test-event.entity.js';
```

- [ ] **Step 5: 커밋**

```bash
git add packages/admin-server/src/entities
git commit -m "feat(admin-server): add TestRun, TestRunItem, TestEvent entities"
```

---

### Task 6: 초기 마이그레이션 생성 + 스키마 검증

**Files:**
- Create: `packages/admin-server/src/db/migrations/Migration00000000000001.ts`

빌드 결과물(`dist/`)에서 마이그레이션을 자동 생성하면 path가 어긋나기 쉬우므로 **수동으로** TS 마이그레이션 1개를 작성한다. 이후 수정은 `mikro-orm migration:create` CLI를 사용.

- [ ] **Step 1: 마이그레이션 디렉토리 생성**

Run: `mkdir -p packages/admin-server/src/db/migrations`

- [ ] **Step 2: `Migration00000000000001.ts` 작성**

```ts
import { Migration } from '@mikro-orm/migrations';

export class Migration00000000000001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table \`test_cases\` (
        \`id\` varchar(64) not null,
        \`name\` varchar(255) not null,
        \`description\` text null,
        \`params\` json not null,
        \`expected\` json not null,
        \`tags\` json not null,
        \`auto_created\` tinyint(1) not null default 0,
        \`created_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        \`updated_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        primary key (\`id\`),
        index \`test_cases_auto_created_index\` (\`auto_created\`)
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`deployments\` (
        \`id\` varchar(36) not null,
        \`git_ref\` varchar(255) not null,
        \`status\` varchar(32) not null default 'pending',
        \`error_message\` text null,
        \`started_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        \`finished_at\` datetime(3) null,
        primary key (\`id\`),
        index \`deployments_status_index\` (\`status\`)
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_files\` (
        \`id\` varchar(36) not null,
        \`deployment_id\` varchar(36) not null,
        \`source_path\` varchar(512) not null,
        \`bundle_key\` varchar(512) not null,
        \`created_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        primary key (\`id\`),
        index \`test_files_deployment_id_index\` (\`deployment_id\`),
        constraint \`test_files_deployment_id_foreign\` foreign key (\`deployment_id\`) references \`deployments\` (\`id\`) on delete cascade
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_case_mappings\` (
        \`id\` varchar(36) not null,
        \`deployment_id\` varchar(36) not null,
        \`test_case_id\` varchar(64) not null,
        \`test_file_id\` varchar(36) not null,
        primary key (\`id\`),
        unique \`test_case_mappings_dep_tc_unique\` (\`deployment_id\`, \`test_case_id\`),
        index \`test_case_mappings_test_case_id_index\` (\`test_case_id\`),
        constraint \`tcm_deployment_fk\` foreign key (\`deployment_id\`) references \`deployments\` (\`id\`) on delete cascade,
        constraint \`tcm_test_case_fk\` foreign key (\`test_case_id\`) references \`test_cases\` (\`id\`) on delete restrict,
        constraint \`tcm_test_file_fk\` foreign key (\`test_file_id\`) references \`test_files\` (\`id\`) on delete cascade
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_runs\` (
        \`id\` varchar(36) not null,
        \`deployment_id\` varchar(36) not null,
        \`requested_test_case_ids\` json not null,
        \`status\` varchar(32) not null default 'queued',
        \`requested_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        \`started_at\` datetime(3) null,
        \`finished_at\` datetime(3) null,
        \`playwright_report_key\` varchar(512) null,
        primary key (\`id\`),
        index \`test_runs_status_index\` (\`status\`),
        constraint \`test_runs_deployment_fk\` foreign key (\`deployment_id\`) references \`deployments\` (\`id\`) on delete restrict
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_run_items\` (
        \`id\` varchar(36) not null,
        \`test_run_id\` varchar(36) not null,
        \`test_case_id\` varchar(64) not null,
        \`test_file_id\` varchar(36) not null,
        \`status\` varchar(32) not null default 'pending',
        \`duration_ms\` int null,
        \`error_message\` text null,
        \`params_snapshot\` json not null,
        \`expected_snapshot\` json not null,
        \`started_at\` datetime(3) null,
        \`finished_at\` datetime(3) null,
        primary key (\`id\`),
        index \`test_run_items_test_run_id_index\` (\`test_run_id\`),
        index \`test_run_items_test_case_id_index\` (\`test_case_id\`),
        constraint \`tri_run_fk\` foreign key (\`test_run_id\`) references \`test_runs\` (\`id\`) on delete cascade,
        constraint \`tri_test_case_fk\` foreign key (\`test_case_id\`) references \`test_cases\` (\`id\`) on delete restrict,
        constraint \`tri_test_file_fk\` foreign key (\`test_file_id\`) references \`test_files\` (\`id\`) on delete restrict
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_events\` (
        \`id\` bigint unsigned not null auto_increment,
        \`test_run_id\` varchar(36) not null,
        \`test_run_item_id\` varchar(36) null,
        \`event_type\` varchar(32) not null,
        \`payload\` json not null,
        \`emitted_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        primary key (\`id\`),
        index \`test_events_run_id_pk_index\` (\`test_run_id\`, \`id\`),
        constraint \`te_run_fk\` foreign key (\`test_run_id\`) references \`test_runs\` (\`id\`) on delete cascade,
        constraint \`te_run_item_fk\` foreign key (\`test_run_item_id\`) references \`test_run_items\` (\`id\`) on delete cascade
      ) default character set utf8mb4 engine = InnoDB;
    `);
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `test_events`;');
    this.addSql('drop table if exists `test_run_items`;');
    this.addSql('drop table if exists `test_runs`;');
    this.addSql('drop table if exists `test_case_mappings`;');
    this.addSql('drop table if exists `test_files`;');
    this.addSql('drop table if exists `deployments`;');
    this.addSql('drop table if exists `test_cases`;');
  }
}
```

- [ ] **Step 3: 타입 컴파일 확인**

Run: `pnpm --filter @platform/admin-server exec tsc --noEmit -p tsconfig.json`
Expected: 타입 에러 없음.

> 이 마이그레이션 파일은 **운영 환경 전용** (Phase 3b의 Dockerfile 빌드 + `mikro-orm migration:up`). 통합 테스트는 vitest 환경에서 MikroORM의 ts glob을 안정적으로 못 읽기 때문에 `SchemaGenerator.refreshDatabase()`로 엔티티 메타에서 직접 스키마를 만든다 (Task 19 참고). 두 경로(마이그레이션, schema generator)가 동일한 스키마를 만들도록 엔티티-마이그레이션 동기화는 사람이 책임진다.

- [ ] **Step 4: 커밋**

```bash
git add packages/admin-server/src/db/migrations
git commit -m "feat(admin-server): add initial schema migration"
```

---

### Task 7: 외부 의존 인터페이스 + Noop stub

**Files:**
- Create: `packages/admin-server/src/queue/run-queue-publisher.ts`
- Create: `packages/admin-server/src/storage/object-storage-client.ts`
- Create: `packages/admin-server/src/deploy/deploy-trigger.ts`

- [ ] **Step 1: `run-queue-publisher.ts` 작성**

```ts
import type { RunItemExecuteMessage } from '@platform/shared';

export interface RunQueuePublisher {
  publish(message: RunItemExecuteMessage): Promise<void>;
}

/**
 * 큐 publisher가 미연결 상태일 때 사용. 메시지를 메모리에 보관해 테스트에서 검사 가능.
 * Phase 3b에서 amqplib 기반 구현으로 교체.
 */
export class NoopRunQueuePublisher implements RunQueuePublisher {
  readonly published: RunItemExecuteMessage[] = [];

  async publish(message: RunItemExecuteMessage): Promise<void> {
    this.published.push(message);
  }
}
```

- [ ] **Step 2: `object-storage-client.ts` 작성**

```ts
export interface ObjectStorageClient {
  presignedGetUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export class NoopObjectStorageClient implements ObjectStorageClient {
  async presignedGetUrl(key: string, expiresInSeconds: number): Promise<string> {
    return `noop://object/${encodeURIComponent(key)}?expires=${expiresInSeconds}`;
  }
}
```

- [ ] **Step 3: `deploy-trigger.ts` 작성**

```ts
export interface DeployTriggerInput {
  deploymentId: string;
  gitRef: string;
}

export interface DeployTrigger {
  trigger(input: DeployTriggerInput): Promise<void>;
}

export class NoopDeployTrigger implements DeployTrigger {
  readonly triggers: DeployTriggerInput[] = [];

  async trigger(input: DeployTriggerInput): Promise<void> {
    this.triggers.push(input);
  }
}
```

- [ ] **Step 4: 커밋**

```bash
git add packages/admin-server/src/queue packages/admin-server/src/storage packages/admin-server/src/deploy
git commit -m "feat(admin-server): add external dependency interfaces and noop stubs"
```

---

### Task 8: Repositories

각 repository는 EntityManager를 받아 쿼리만 캡슐화한다. 트랜잭션은 service에서 관리한다.

**Files:**
- Create: `packages/admin-server/src/repositories/test-case.repository.ts`
- Create: `packages/admin-server/src/repositories/deployment.repository.ts`
- Create: `packages/admin-server/src/repositories/test-file.repository.ts`
- Create: `packages/admin-server/src/repositories/test-case-mapping.repository.ts`
- Create: `packages/admin-server/src/repositories/test-run.repository.ts`
- Create: `packages/admin-server/src/repositories/test-run-item.repository.ts`
- Create: `packages/admin-server/src/repositories/test-event.repository.ts`

- [ ] **Step 1: `test-case.repository.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import { TestCase } from '../entities/test-case.entity.js';

export interface ListTestCasesQuery {
  q?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export class TestCaseRepository {
  constructor(private readonly em: EntityManager) {}

  async listWithFilter(query: ListTestCasesQuery): Promise<{ items: TestCase[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Record<string, unknown> = {};
    if (query.q) {
      where.$or = [
        { id: { $like: `%${query.q}%` } },
        { name: { $like: `%${query.q}%` } },
      ];
    }
    if (query.tag) {
      where.tags = { $like: `%"${query.tag}"%` };
    }
    const [items, total] = await this.em.findAndCount(TestCase, where, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: { id: 'asc' },
    });
    return { items, total };
  }

  async findById(id: string): Promise<TestCase | null> {
    return this.em.findOne(TestCase, { id });
  }

  async findByIds(ids: string[]): Promise<TestCase[]> {
    if (ids.length === 0) return [];
    return this.em.find(TestCase, { id: { $in: ids } });
  }
}
```

> JSON `tags` 필터는 단순 LIKE로 충분하다 (데모 범위). 운영용은 MySQL JSON_CONTAINS이지만 여기서는 단순화.

- [ ] **Step 2: `deployment.repository.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import { DeploymentStatus } from '@platform/shared';
import { Deployment } from '../entities/deployment.entity.js';

export class DeploymentRepository {
  constructor(private readonly em: EntityManager) {}

  async list(query: { status?: DeploymentStatus; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    const [items, total] = await this.em.findAndCount(Deployment, where, {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: { startedAt: 'desc' },
    });
    return { items, total };
  }

  async findById(id: string): Promise<Deployment | null> {
    return this.em.findOne(Deployment, { id });
  }

  async findLatestSuccess(): Promise<Deployment | null> {
    return this.em.findOne(
      Deployment,
      { status: DeploymentStatus.Success },
      { orderBy: { finishedAt: 'desc' } },
    );
  }
}
```

- [ ] **Step 3: `test-file.repository.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import { TestFile } from '../entities/test-file.entity.js';

export class TestFileRepository {
  constructor(private readonly em: EntityManager) {}

  async findByDeploymentId(deploymentId: string): Promise<TestFile[]> {
    return this.em.find(TestFile, { deployment: deploymentId }, { orderBy: { sourcePath: 'asc' } });
  }
}
```

- [ ] **Step 4: `test-case-mapping.repository.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import { TestCaseMapping } from '../entities/test-case-mapping.entity.js';

export class TestCaseMappingRepository {
  constructor(private readonly em: EntityManager) {}

  async findByDeploymentId(deploymentId: string): Promise<TestCaseMapping[]> {
    return this.em.find(
      TestCaseMapping,
      { deployment: deploymentId },
      { populate: ['testCase', 'testFile'] },
    );
  }

  async findByDeploymentAndTcs(deploymentId: string, tcIds: string[]): Promise<TestCaseMapping[]> {
    if (tcIds.length === 0) return [];
    return this.em.find(
      TestCaseMapping,
      { deployment: deploymentId, testCase: { $in: tcIds } },
      { populate: ['testCase', 'testFile'] },
    );
  }
}
```

> active TC id 집합 계산은 service 책임 — `DeploymentRepository.findLatestSuccess()` 후 `findByDeploymentId(latestSuccess.id)`로 매핑 조회 → TC id Set으로 변환.

- [ ] **Step 5: `test-run.repository.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import { TestRun } from '../entities/test-run.entity.js';

export class TestRunRepository {
  constructor(private readonly em: EntityManager) {}

  async list(query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const [items, total] = await this.em.findAndCount(
      TestRun,
      {},
      {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: { requestedAt: 'desc' },
      },
    );
    return { items, total };
  }

  async findById(id: string): Promise<TestRun | null> {
    return this.em.findOne(TestRun, { id });
  }

  async findByIds(ids: string[]): Promise<TestRun[]> {
    if (ids.length === 0) return [];
    return this.em.find(TestRun, { id: { $in: ids } });
  }
}
```

- [ ] **Step 6: `test-run-item.repository.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import { TestRunItem } from '../entities/test-run-item.entity.js';

export class TestRunItemRepository {
  constructor(private readonly em: EntityManager) {}

  async findByRunId(runId: string): Promise<TestRunItem[]> {
    return this.em.find(TestRunItem, { testRun: runId }, { populate: ['testCase', 'testFile'] });
  }

  async findByTestCaseId(testCaseId: string, limit = 50): Promise<TestRunItem[]> {
    return this.em.find(
      TestRunItem,
      { testCase: testCaseId },
      { limit, orderBy: { startedAt: 'desc' } },
    );
  }

  async findById(id: string): Promise<TestRunItem | null> {
    return this.em.findOne(TestRunItem, { id });
  }
}
```

- [ ] **Step 7: `test-event.repository.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import type { ReporterEvent } from '@platform/shared';
import { TestEvent } from '../entities/test-event.entity.js';

export class TestEventRepository {
  constructor(private readonly em: EntityManager) {}

  async insertBatch(testRunId: string, events: ReporterEvent[]): Promise<void> {
    for (const event of events) {
      const entity = this.em.create(TestEvent, {
        testRun: testRunId,
        testRunItem: event.itemId,
        eventType: event.type,
        payload: event.payload as Record<string, unknown>,
        emittedAt: new Date(event.ts),
      });
      this.em.persist(entity);
    }
  }
}
```

- [ ] **Step 8: 커밋**

```bash
git add packages/admin-server/src/repositories
git commit -m "feat(admin-server): add MikroORM repositories"
```

---

### Task 9: Mappers + ApiError

**Files:**
- Create: `packages/admin-server/src/services/mappers.ts`
- Create: `packages/admin-server/src/app/api/_lib/error-handler.ts`

- [ ] **Step 1: `mappers.ts` 작성**

```ts
import type {
  TestCaseDto,
  DeploymentDto,
  TestFileDto,
  RunDto,
  RunItemDto,
} from '@platform/shared';
import type { TestCase } from '../entities/test-case.entity.js';
import type { Deployment } from '../entities/deployment.entity.js';
import type { TestFile } from '../entities/test-file.entity.js';
import type { TestRun } from '../entities/test-run.entity.js';
import type { TestRunItem } from '../entities/test-run-item.entity.js';

export function toTestCaseDto(entity: TestCase, isActive: boolean): TestCaseDto {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    params: entity.params,
    expected: entity.expected,
    tags: entity.tags,
    autoCreated: entity.autoCreated,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    isActive,
  };
}

export function toDeploymentDto(entity: Deployment): DeploymentDto {
  return {
    id: entity.id,
    gitRef: entity.gitRef,
    status: entity.status,
    errorMessage: entity.errorMessage,
    startedAt: entity.startedAt.toISOString(),
    finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
  };
}

export function toTestFileDto(entity: TestFile): TestFileDto {
  return {
    id: entity.id,
    deploymentId: entity.deployment.id,
    sourcePath: entity.sourcePath,
    bundleKey: entity.bundleKey,
    createdAt: entity.createdAt.toISOString(),
  };
}

export function toRunDto(entity: TestRun): RunDto {
  return {
    id: entity.id,
    deploymentId: entity.deployment.id,
    requestedTestCaseIds: entity.requestedTestCaseIds,
    status: entity.status,
    requestedAt: entity.requestedAt.toISOString(),
    startedAt: entity.startedAt ? entity.startedAt.toISOString() : null,
    finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
    playwrightReportKey: entity.playwrightReportKey,
  };
}

export function toRunItemDto(entity: TestRunItem): RunItemDto {
  return {
    id: entity.id,
    testRunId: entity.testRun.id,
    testCaseId: entity.testCase.id,
    testFileId: entity.testFile.id,
    status: entity.status,
    durationMs: entity.durationMs,
    errorMessage: entity.errorMessage,
    paramsSnapshot: entity.paramsSnapshot,
    expectedSnapshot: entity.expectedSnapshot,
    startedAt: entity.startedAt ? entity.startedAt.toISOString() : null,
    finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
  };
}
```

- [ ] **Step 2: `error-handler.ts` 작성**

```ts
import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code ?? 'error', message: error.message } },
      { status: error.status },
    );
  }
  console.error('[admin-server] unexpected error', error);
  return NextResponse.json(
    { error: { code: 'internal', message: 'Internal Server Error' } },
    { status: 500 },
  );
}

export async function handleRoute<T>(handler: () => Promise<NextResponse<T>>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (e) {
    return jsonError(e);
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add packages/admin-server/src/services/mappers.ts packages/admin-server/src/app/api/_lib
git commit -m "feat(admin-server): add DTO mappers and API error handler"
```

---

### Task 10: TestCaseService — TDD

**Files:**
- Create: `packages/admin-server/src/services/test-case.service.ts`
- Create: `packages/admin-server/tests/unit/test-case.service.test.ts`

서비스는 EntityManager + repository + mapper를 조합. 단위 테스트는 vitest mock으로 repository를 대체.

- [ ] **Step 1: 실패 테스트 작성 — `test-case.service.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestCaseService } from '../../src/services/test-case.service.js';
import { ApiError } from '../../src/app/api/_lib/error-handler.js';

const makeEntity = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'TC-001',
  name: 'cart add',
  description: null,
  params: { qty: 1 },
  expected: { count: 1 },
  tags: ['cart'],
  autoCreated: true,
  createdAt: new Date('2026-04-13T00:00:00Z'),
  updatedAt: new Date('2026-04-13T00:00:00Z'),
  ...over,
});

describe('TestCaseService', () => {
  let testCaseRepo: { listWithFilter: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn>; findByIds: ReturnType<typeof vi.fn> };
  let mappingRepo: { findByDeploymentId: ReturnType<typeof vi.fn> };
  let deploymentRepo: { findLatestSuccess: ReturnType<typeof vi.fn> };
  let em: { flush: ReturnType<typeof vi.fn> };
  let service: TestCaseService;

  beforeEach(() => {
    testCaseRepo = { listWithFilter: vi.fn(), findById: vi.fn(), findByIds: vi.fn() };
    mappingRepo = { findByDeploymentId: vi.fn() };
    deploymentRepo = { findLatestSuccess: vi.fn() };
    em = { flush: vi.fn() };
    service = new TestCaseService(em as any, testCaseRepo as any, mappingRepo as any, deploymentRepo as any);
  });

  it('list — active set 계산 후 isActive 부착', async () => {
    testCaseRepo.listWithFilter.mockResolvedValue({ items: [makeEntity({ id: 'TC-001' }), makeEntity({ id: 'TC-002' })], total: 2 });
    deploymentRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    mappingRepo.findByDeploymentId.mockResolvedValue([{ testCase: { id: 'TC-001' } }]);

    const result = await service.list({});

    expect(result.total).toBe(2);
    expect(result.items[0].isActive).toBe(true);
    expect(result.items[1].isActive).toBe(false);
  });

  it('list — active_only=true는 inactive를 제외', async () => {
    testCaseRepo.listWithFilter.mockResolvedValue({ items: [makeEntity({ id: 'TC-001' }), makeEntity({ id: 'TC-002' })], total: 2 });
    deploymentRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    mappingRepo.findByDeploymentId.mockResolvedValue([{ testCase: { id: 'TC-001' } }]);

    const result = await service.list({ activeOnly: true });

    expect(result.items.map((i) => i.id)).toEqual(['TC-001']);
  });

  it('list — 성공 배포가 없으면 모두 inactive', async () => {
    testCaseRepo.listWithFilter.mockResolvedValue({ items: [makeEntity()], total: 1 });
    deploymentRepo.findLatestSuccess.mockResolvedValue(null);

    const result = await service.list({});
    expect(result.items[0].isActive).toBe(false);
  });

  it('getById — 존재하지 않으면 ApiError 404', async () => {
    testCaseRepo.findById.mockResolvedValue(null);
    await expect(service.getById('TC-X')).rejects.toBeInstanceOf(ApiError);
    await expect(service.getById('TC-X')).rejects.toMatchObject({ status: 404 });
  });

  it('patch — 존재하면 부분 갱신 후 flush', async () => {
    const entity = makeEntity();
    testCaseRepo.findById.mockResolvedValue(entity);
    deploymentRepo.findLatestSuccess.mockResolvedValue(null);

    const result = await service.patch('TC-001', { name: 'new name', tags: ['updated'] });

    expect(em.flush).toHaveBeenCalledOnce();
    expect(entity.name).toBe('new name');
    expect(entity.tags).toEqual(['updated']);
    expect(result.id).toBe('TC-001');
  });

  it('patch — 존재하지 않으면 ApiError 404', async () => {
    testCaseRepo.findById.mockResolvedValue(null);
    await expect(service.patch('TC-X', { name: 'x' })).rejects.toMatchObject({ status: 404 });
  });

  it('listRunnable — 최신 성공 배포 매핑의 TC만 반환', async () => {
    deploymentRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1' });
    mappingRepo.findByDeploymentId.mockResolvedValue([
      { testCase: makeEntity({ id: 'TC-001' }) },
      { testCase: makeEntity({ id: 'TC-002' }) },
    ]);
    const result = await service.listRunnable();
    expect(result.map((tc) => tc.id)).toEqual(['TC-001', 'TC-002']);
    expect(result.every((tc) => tc.isActive)).toBe(true);
  });

  it('listRunnable — 성공 배포 없으면 빈 배열', async () => {
    deploymentRepo.findLatestSuccess.mockResolvedValue(null);
    const result = await service.listRunnable();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @platform/admin-server test:unit -- test-case.service.test.ts`
Expected: FAIL — `TestCaseService` 모듈 없음.

- [ ] **Step 3: `test-case.service.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import type { TestCaseDto, TestCasePatchDto } from '@platform/shared';
import type { TestCaseRepository } from '../repositories/test-case.repository.js';
import type { TestCaseMappingRepository } from '../repositories/test-case-mapping.repository.js';
import type { DeploymentRepository } from '../repositories/deployment.repository.js';
import { ApiError } from '../app/api/_lib/error-handler.js';
import { toTestCaseDto } from './mappers.js';

export interface ListTestCasesQuery {
  q?: string;
  tag?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export class TestCaseService {
  constructor(
    private readonly em: EntityManager,
    private readonly testCases: TestCaseRepository,
    private readonly mappings: TestCaseMappingRepository,
    private readonly deployments: DeploymentRepository,
  ) {}

  async list(query: ListTestCasesQuery): Promise<{ items: TestCaseDto[]; total: number }> {
    const { items, total } = await this.testCases.listWithFilter(query);
    const activeIds = await this.computeActiveIds();
    const mapped = items.map((e) => toTestCaseDto(e, activeIds.has(e.id)));
    if (query.activeOnly) {
      const filtered = mapped.filter((dto) => dto.isActive);
      return { items: filtered, total: filtered.length };
    }
    return { items: mapped, total };
  }

  async getById(id: string): Promise<TestCaseDto> {
    const entity = await this.testCases.findById(id);
    if (!entity) throw new ApiError(404, `test case ${id} not found`, 'not_found');
    const activeIds = await this.computeActiveIds();
    return toTestCaseDto(entity, activeIds.has(id));
  }

  async patch(id: string, patch: TestCasePatchDto): Promise<TestCaseDto> {
    const entity = await this.testCases.findById(id);
    if (!entity) throw new ApiError(404, `test case ${id} not found`, 'not_found');
    if (patch.name !== undefined) entity.name = patch.name;
    if (patch.description !== undefined) entity.description = patch.description;
    if (patch.params !== undefined) entity.params = patch.params;
    if (patch.expected !== undefined) entity.expected = patch.expected;
    if (patch.tags !== undefined) entity.tags = patch.tags;
    await this.em.flush();
    const activeIds = await this.computeActiveIds();
    return toTestCaseDto(entity, activeIds.has(id));
  }

  async listRunnable(): Promise<TestCaseDto[]> {
    const dep = await this.deployments.findLatestSuccess();
    if (!dep) return [];
    const mappings = await this.mappings.findByDeploymentId(dep.id);
    return mappings.map((m) => toTestCaseDto(m.testCase, true));
  }

  private async computeActiveIds(): Promise<Set<string>> {
    const dep = await this.deployments.findLatestSuccess();
    if (!dep) return new Set();
    const mappings = await this.mappings.findByDeploymentId(dep.id);
    return new Set(mappings.map((m) => m.testCase.id));
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @platform/admin-server test:unit -- test-case.service.test.ts`
Expected: PASS — 7개 케이스 모두 통과.

- [ ] **Step 5: 커밋**

```bash
git add packages/admin-server/src/services/test-case.service.ts packages/admin-server/tests/unit/test-case.service.test.ts
git commit -m "feat(admin-server): add TestCaseService with isActive computation"
```

---

### Task 11: DeploymentService — TDD

**Files:**
- Create: `packages/admin-server/src/services/deployment.service.ts`
- Create: `packages/admin-server/tests/unit/deployment.service.test.ts`

Phase 3a에서 `DeploymentService`는 **생성 + 조회 + 트리거 호출**까지만 담당. 매핑 트랜잭션(`upsertMappings`)은 internal API와 함께 Phase 3b에서 추가.

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeploymentService } from '../../src/services/deployment.service.js';
import { DeploymentStatus } from '@platform/shared';
import { ApiError } from '../../src/app/api/_lib/error-handler.js';

const makeDep = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'dep-1',
  gitRef: 'main',
  status: DeploymentStatus.Pending,
  errorMessage: null,
  startedAt: new Date('2026-04-13T00:00:00Z'),
  finishedAt: null,
  ...over,
});

describe('DeploymentService', () => {
  let depRepo: any;
  let fileRepo: any;
  let trigger: { trigger: ReturnType<typeof vi.fn> };
  let em: { persistAndFlush: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let service: DeploymentService;

  beforeEach(() => {
    depRepo = { list: vi.fn(), findById: vi.fn(), findLatestSuccess: vi.fn() };
    fileRepo = { findByDeploymentId: vi.fn() };
    trigger = { trigger: vi.fn().mockResolvedValue(undefined) };
    em = {
      persistAndFlush: vi.fn().mockResolvedValue(undefined),
      create: vi.fn((_cls, data) => ({ ...makeDep(), ...data })),
    };
    service = new DeploymentService(em as any, depRepo, fileRepo, trigger as any);
  });

  it('create — pending 상태로 INSERT 후 deploy 트리거 호출, DTO 반환', async () => {
    const dto = await service.create({ gitRef: 'feature/x' });

    expect(em.create).toHaveBeenCalled();
    expect(em.persistAndFlush).toHaveBeenCalledOnce();
    expect(trigger.trigger).toHaveBeenCalledWith({ deploymentId: dto.id, gitRef: 'feature/x' });
    expect(dto.gitRef).toBe('feature/x');
    expect(dto.status).toBe(DeploymentStatus.Pending);
  });

  it('create — 트리거 실패해도 deployment row는 남는다 (status pending으로)', async () => {
    trigger.trigger.mockRejectedValue(new Error('deploy down'));
    await expect(service.create({ gitRef: 'main' })).rejects.toThrow('deploy down');
    expect(em.persistAndFlush).toHaveBeenCalledOnce();
  });

  it('list — pagination 위임', async () => {
    depRepo.list.mockResolvedValue({ items: [makeDep()], total: 1 });
    const result = await service.list({ page: 2, pageSize: 10 });
    expect(depRepo.list).toHaveBeenCalledWith({ page: 2, pageSize: 10, status: undefined });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('dep-1');
  });

  it('getById — 없으면 404', async () => {
    depRepo.findById.mockResolvedValue(null);
    await expect(service.getById('x')).rejects.toMatchObject({ status: 404 });
  });

  it('listTestFiles — repository 위임 후 DTO 변환', async () => {
    depRepo.findById.mockResolvedValue(makeDep());
    fileRepo.findByDeploymentId.mockResolvedValue([
      { id: 'f1', deployment: { id: 'dep-1' }, sourcePath: 'a.spec.ts', bundleKey: 'k1', createdAt: new Date() },
    ]);
    const items = await service.listTestFiles('dep-1');
    expect(items).toHaveLength(1);
    expect(items[0].sourcePath).toBe('a.spec.ts');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @platform/admin-server test:unit -- deployment.service.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `deployment.service.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import type { DeploymentDto, DeploymentCreateDto, DeploymentStatus, TestFileDto } from '@platform/shared';
import { Deployment } from '../entities/deployment.entity.js';
import type { DeploymentRepository } from '../repositories/deployment.repository.js';
import type { TestFileRepository } from '../repositories/test-file.repository.js';
import type { DeployTrigger } from '../deploy/deploy-trigger.js';
import { ApiError } from '../app/api/_lib/error-handler.js';
import { toDeploymentDto, toTestFileDto } from './mappers.js';

export class DeploymentService {
  constructor(
    private readonly em: EntityManager,
    private readonly deployments: DeploymentRepository,
    private readonly files: TestFileRepository,
    private readonly trigger: DeployTrigger,
  ) {}

  async list(query: { status?: DeploymentStatus; page?: number; pageSize?: number }): Promise<{
    items: DeploymentDto[];
    total: number;
  }> {
    const { items, total } = await this.deployments.list({
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map(toDeploymentDto), total };
  }

  async getById(id: string): Promise<DeploymentDto> {
    const dep = await this.deployments.findById(id);
    if (!dep) throw new ApiError(404, `deployment ${id} not found`, 'not_found');
    return toDeploymentDto(dep);
  }

  async create(dto: DeploymentCreateDto): Promise<DeploymentDto> {
    const dep = this.em.create(Deployment, { gitRef: dto.gitRef });
    await this.em.persistAndFlush(dep);
    await this.trigger.trigger({ deploymentId: dep.id, gitRef: dep.gitRef });
    return toDeploymentDto(dep);
  }

  async listTestFiles(deploymentId: string): Promise<TestFileDto[]> {
    const dep = await this.deployments.findById(deploymentId);
    if (!dep) throw new ApiError(404, `deployment ${deploymentId} not found`, 'not_found');
    const files = await this.files.findByDeploymentId(deploymentId);
    return files.map(toTestFileDto);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @platform/admin-server test:unit -- deployment.service.test.ts`
Expected: PASS — 5개 케이스.

- [ ] **Step 5: 커밋**

```bash
git add packages/admin-server/src/services/deployment.service.ts packages/admin-server/tests/unit/deployment.service.test.ts
git commit -m "feat(admin-server): add DeploymentService (create/list/get/files)"
```

---

### Task 12: RunService — TDD

**Files:**
- Create: `packages/admin-server/src/services/run.service.ts`
- Create: `packages/admin-server/tests/unit/run.service.test.ts`

`RunService.create()`는 스펙 §6.2의 핵심: 최신 성공 배포 확인 → TC 매핑 검증 → snapshot 박제 → run/items INSERT → 큐 publish.

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunService } from '../../src/services/run.service.js';
import { RunStatus, RunItemStatus, DeploymentStatus, ROUTING_KEY_RUN_ITEM_EXECUTE } from '@platform/shared';
import { ApiError } from '../../src/app/api/_lib/error-handler.js';

describe('RunService', () => {
  let depRepo: any;
  let tcRepo: any;
  let mapRepo: any;
  let runRepo: any;
  let runItemRepo: any;
  let storage: { presignedGetUrl: ReturnType<typeof vi.fn> };
  let publisher: { publish: ReturnType<typeof vi.fn> };
  let em: any;
  let service: RunService;

  beforeEach(() => {
    depRepo = { findLatestSuccess: vi.fn() };
    tcRepo = { findByIds: vi.fn() };
    mapRepo = { findByDeploymentAndTcs: vi.fn() };
    runRepo = { list: vi.fn(), findById: vi.fn() };
    runItemRepo = { findByRunId: vi.fn(), findByTestCaseId: vi.fn() };
    storage = { presignedGetUrl: vi.fn().mockResolvedValue('https://signed/x') };
    publisher = { publish: vi.fn().mockResolvedValue(undefined) };
    em = {
      create: vi.fn((_cls, data) => ({ id: data.id ?? 'auto', ...data })),
      persist: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      transactional: vi.fn(async (fn: any) => fn(em)),
    };
    service = new RunService(em, depRepo, tcRepo, mapRepo, runRepo, runItemRepo, publisher as any, storage as any, 'http://admin:3000');
  });

  it('create — 최신 성공 배포 없으면 409', async () => {
    depRepo.findLatestSuccess.mockResolvedValue(null);
    await expect(service.create({ testCaseIds: ['TC-1'] })).rejects.toMatchObject({ status: 409 });
  });

  it('create — 매핑되지 않은 TC가 있으면 400', async () => {
    depRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1', status: DeploymentStatus.Success });
    tcRepo.findByIds.mockResolvedValue([{ id: 'TC-1', params: {}, expected: {} }]);
    mapRepo.findByDeploymentAndTcs.mockResolvedValue([]);
    await expect(service.create({ testCaseIds: ['TC-1'] })).rejects.toMatchObject({ status: 400 });
  });

  it('create — TC params/expected를 snapshot으로 박제', async () => {
    depRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1', status: DeploymentStatus.Success });
    const tc = { id: 'TC-1', params: { qty: 2 }, expected: { count: 2 } };
    tcRepo.findByIds.mockResolvedValue([tc]);
    mapRepo.findByDeploymentAndTcs.mockResolvedValue([
      { testCase: tc, testFile: { id: 'file-1', bundleKey: 'k1' } },
    ]);

    await service.create({ testCaseIds: ['TC-1'] });

    const itemCalls = em.create.mock.calls.filter((c: any[]) => c[1].paramsSnapshot !== undefined);
    expect(itemCalls).toHaveLength(1);
    expect(itemCalls[0][1].paramsSnapshot).toEqual({ qty: 2 });
    expect(itemCalls[0][1].expectedSnapshot).toEqual({ count: 2 });
    expect(itemCalls[0][1].status).toBe(RunItemStatus.Pending);
  });

  it('create — paramOverrides가 snapshot에 반영', async () => {
    depRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1', status: DeploymentStatus.Success });
    const tc = { id: 'TC-1', params: { qty: 1 }, expected: { count: 1 } };
    tcRepo.findByIds.mockResolvedValue([tc]);
    mapRepo.findByDeploymentAndTcs.mockResolvedValue([
      { testCase: tc, testFile: { id: 'file-1', bundleKey: 'k1' } },
    ]);

    await service.create({
      testCaseIds: ['TC-1'],
      paramOverrides: { 'TC-1': { qty: 5 } },
    });

    const itemCall = em.create.mock.calls.find((c: any[]) => c[1].paramsSnapshot !== undefined);
    expect(itemCall![1].paramsSnapshot).toEqual({ qty: 5 });
  });

  it('create — 각 item마다 RabbitMQ publish, 페이로드는 routing key용 메시지 형태', async () => {
    depRepo.findLatestSuccess.mockResolvedValue({ id: 'dep-1', status: DeploymentStatus.Success });
    const tc1 = { id: 'TC-1', params: {}, expected: {} };
    const tc2 = { id: 'TC-2', params: {}, expected: {} };
    tcRepo.findByIds.mockResolvedValue([tc1, tc2]);
    mapRepo.findByDeploymentAndTcs.mockResolvedValue([
      { testCase: tc1, testFile: { id: 'file-1', bundleKey: 'k1' } },
      { testCase: tc2, testFile: { id: 'file-2', bundleKey: 'k2' } },
    ]);

    await service.create({ testCaseIds: ['TC-1', 'TC-2'] });

    expect(publisher.publish).toHaveBeenCalledTimes(2);
    const firstMsg = publisher.publish.mock.calls[0][0];
    expect(firstMsg.testCaseId).toBe('TC-1');
    expect(firstMsg.deploymentId).toBe('dep-1');
    expect(firstMsg.testFileBundleKey).toBe('k1');
    expect(firstMsg.adminBaseUrl).toBe('http://admin:3000');
  });

  it('getReportUrl — playwrightReportKey 없으면 404', async () => {
    runRepo.findById.mockResolvedValue({ id: 'r1', playwrightReportKey: null });
    await expect(service.getReportUrl('r1')).rejects.toMatchObject({ status: 404 });
  });

  it('getReportUrl — 있으면 storage.presignedGetUrl 위임', async () => {
    runRepo.findById.mockResolvedValue({ id: 'r1', playwrightReportKey: 'runs/r1/report/index.html' });
    const url = await service.getReportUrl('r1');
    expect(storage.presignedGetUrl).toHaveBeenCalledWith('runs/r1/report/index.html', expect.any(Number));
    expect(url).toBe('https://signed/x');
  });

  it('listRunsForTestCase — items로부터 unique run id 추출, run을 DTO로 반환', async () => {
    runItemRepo.findByTestCaseId.mockResolvedValue([
      { testRun: { id: 'r1' } },
      { testRun: { id: 'r1' } },
      { testRun: { id: 'r2' } },
    ]);
    runRepo.findByIds = vi.fn().mockResolvedValue([
      { id: 'r1', deployment: { id: 'd1' }, requestedTestCaseIds: ['TC-1'], status: RunStatus.Success, requestedAt: new Date(), startedAt: null, finishedAt: null, playwrightReportKey: null },
      { id: 'r2', deployment: { id: 'd1' }, requestedTestCaseIds: ['TC-1'], status: RunStatus.Failed, requestedAt: new Date(), startedAt: null, finishedAt: null, playwrightReportKey: null },
    ]);
    const items = await service.listRunsForTestCase('TC-1');
    expect(items).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @platform/admin-server test:unit -- run.service.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: `run.service.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import {
  RunStatus,
  RunItemStatus,
  type RunDto,
  type RunItemDto,
  type RunCreateDto,
  type RunItemExecuteMessage,
} from '@platform/shared';
import { TestRun } from '../entities/test-run.entity.js';
import { TestRunItem } from '../entities/test-run-item.entity.js';
import type { DeploymentRepository } from '../repositories/deployment.repository.js';
import type { TestCaseRepository } from '../repositories/test-case.repository.js';
import type { TestCaseMappingRepository } from '../repositories/test-case-mapping.repository.js';
import type { TestRunRepository } from '../repositories/test-run.repository.js';
import type { TestRunItemRepository } from '../repositories/test-run-item.repository.js';
import type { RunQueuePublisher } from '../queue/run-queue-publisher.js';
import type { ObjectStorageClient } from '../storage/object-storage-client.js';
import { ApiError } from '../app/api/_lib/error-handler.js';
import { toRunDto, toRunItemDto } from './mappers.js';

const REPORT_URL_TTL_SECONDS = 60 * 10;

export class RunService {
  constructor(
    private readonly em: EntityManager,
    private readonly deployments: DeploymentRepository,
    private readonly testCases: TestCaseRepository,
    private readonly mappings: TestCaseMappingRepository,
    private readonly runs: TestRunRepository,
    private readonly runItems: TestRunItemRepository,
    private readonly publisher: RunQueuePublisher,
    private readonly storage: ObjectStorageClient,
    private readonly adminBaseUrl: string,
  ) {}

  async create(dto: RunCreateDto): Promise<RunDto> {
    if (dto.testCaseIds.length === 0) {
      throw new ApiError(400, 'testCaseIds must not be empty', 'invalid_input');
    }
    const dep = await this.deployments.findLatestSuccess();
    if (!dep) throw new ApiError(409, 'no successful deployment available', 'no_deployment');

    const tcs = await this.testCases.findByIds(dto.testCaseIds);
    const tcById = new Map(tcs.map((t) => [t.id, t]));
    const missingTcs = dto.testCaseIds.filter((id) => !tcById.has(id));
    if (missingTcs.length > 0) {
      throw new ApiError(400, `unknown test cases: ${missingTcs.join(',')}`, 'unknown_tc');
    }

    const mappings = await this.mappings.findByDeploymentAndTcs(dep.id, dto.testCaseIds);
    const mapByTc = new Map(mappings.map((m) => [m.testCase.id, m]));
    const unmapped = dto.testCaseIds.filter((id) => !mapByTc.has(id));
    if (unmapped.length > 0) {
      throw new ApiError(400, `not mapped in current deployment: ${unmapped.join(',')}`, 'unmapped_tc');
    }

    const run = this.em.create(TestRun, {
      deployment: dep,
      requestedTestCaseIds: [...dto.testCaseIds],
      status: RunStatus.Queued,
    });
    this.em.persist(run);

    const items: TestRunItem[] = [];
    for (const tcId of dto.testCaseIds) {
      const mapping = mapByTc.get(tcId)!;
      const tc = tcById.get(tcId)!;
      const overrides = dto.paramOverrides?.[tcId];
      const item = this.em.create(TestRunItem, {
        testRun: run,
        testCase: tc,
        testFile: mapping.testFile,
        status: RunItemStatus.Pending,
        paramsSnapshot: overrides ? { ...tc.params, ...overrides } : { ...tc.params },
        expectedSnapshot: { ...tc.expected },
      });
      this.em.persist(item);
      items.push(item);
    }
    await this.em.flush();

    for (const item of items) {
      const message: RunItemExecuteMessage = {
        runId: run.id,
        itemId: item.id,
        deploymentId: dep.id,
        testCaseId: item.testCase.id,
        testFileBundleKey: item.testFile.bundleKey,
        adminBaseUrl: this.adminBaseUrl,
      };
      await this.publisher.publish(message);
    }

    return toRunDto(run);
  }

  async list(query: { page?: number; pageSize?: number }): Promise<{ items: RunDto[]; total: number }> {
    const { items, total } = await this.runs.list(query);
    return { items: items.map(toRunDto), total };
  }

  async getById(id: string): Promise<{ run: RunDto; items: RunItemDto[] }> {
    const run = await this.runs.findById(id);
    if (!run) throw new ApiError(404, `run ${id} not found`, 'not_found');
    const items = await this.runItems.findByRunId(id);
    return { run: toRunDto(run), items: items.map(toRunItemDto) };
  }

  async getReportUrl(id: string): Promise<string> {
    const run = await this.runs.findById(id);
    if (!run) throw new ApiError(404, `run ${id} not found`, 'not_found');
    if (!run.playwrightReportKey) throw new ApiError(404, 'report not ready', 'no_report');
    return this.storage.presignedGetUrl(run.playwrightReportKey, REPORT_URL_TTL_SECONDS);
  }

  async listRunsForTestCase(testCaseId: string): Promise<RunDto[]> {
    const items = await this.runItems.findByTestCaseId(testCaseId);
    const uniqueIds = [...new Set(items.map((i) => i.testRun.id))];
    const runs = await this.runs.findByIds(uniqueIds);
    return runs.map(toRunDto);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @platform/admin-server test:unit -- run.service.test.ts`
Expected: PASS — 8개 케이스.

- [ ] **Step 5: 커밋**

```bash
git add packages/admin-server/src/services/run.service.ts packages/admin-server/tests/unit/run.service.test.ts
git commit -m "feat(admin-server): add RunService (create/list/get/report)"
```

---

### Task 13: EventIngestService — TDD

**Files:**
- Create: `packages/admin-server/src/services/event-ingest.service.ts`
- Create: `packages/admin-server/tests/unit/event-ingest.service.test.ts`

스펙 §5.2: `POST /internal/runs/:id/events`와 `POST /internal/runs/:id/items/:item_id/status`. Phase 3a에서는 internal API 라우트는 만들지 않지만, 서비스 로직은 미리 구현해 3b에서 라우트만 얹으면 되도록 한다.

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventIngestService } from '../../src/services/event-ingest.service.js';
import {
  ReporterEventType,
  RunItemStatus,
  RunStatus,
  type ReporterEventBatch,
} from '@platform/shared';
import { ApiError } from '../../src/app/api/_lib/error-handler.js';

describe('EventIngestService', () => {
  let runRepo: any;
  let runItemRepo: any;
  let eventRepo: any;
  let em: any;
  let service: EventIngestService;

  beforeEach(() => {
    runRepo = { findById: vi.fn() };
    runItemRepo = { findById: vi.fn(), findByRunId: vi.fn() };
    eventRepo = { insertBatch: vi.fn() };
    em = { flush: vi.fn().mockResolvedValue(undefined) };
    service = new EventIngestService(em, runRepo, runItemRepo, eventRepo);
  });

  it('appendEvents — run 존재하면 batch insert + flush', async () => {
    runRepo.findById.mockResolvedValue({ id: 'r1' });
    const batch: ReporterEventBatch = {
      events: [
        { type: ReporterEventType.TestBegin, itemId: 'i1', ts: '2026-04-13T00:00:00Z', payload: {} },
      ],
    };
    await service.appendEvents('r1', batch);
    expect(eventRepo.insertBatch).toHaveBeenCalledWith('r1', batch.events);
    expect(em.flush).toHaveBeenCalled();
  });

  it('appendEvents — run 없으면 404', async () => {
    runRepo.findById.mockResolvedValue(null);
    await expect(service.appendEvents('x', { events: [] })).rejects.toMatchObject({ status: 404 });
  });

  it('updateItemStatus — item 상태와 종료 시각 갱신', async () => {
    const item = { id: 'i1', status: RunItemStatus.Running, durationMs: null, errorMessage: null, finishedAt: null };
    runItemRepo.findById.mockResolvedValue(item);
    await service.updateItemStatus('r1', 'i1', { status: RunItemStatus.Passed, durationMs: 42 });
    expect(item.status).toBe(RunItemStatus.Passed);
    expect(item.durationMs).toBe(42);
    expect(item.finishedAt).toBeInstanceOf(Date);
    expect(em.flush).toHaveBeenCalled();
  });

  it('updateItemStatus — item 없으면 404', async () => {
    runItemRepo.findById.mockResolvedValue(null);
    await expect(service.updateItemStatus('r1', 'i1', { status: RunItemStatus.Passed })).rejects.toMatchObject({ status: 404 });
  });

  it('completeRun — items 모두 passed면 run.status=success', async () => {
    const run = { id: 'r1', status: RunStatus.Running, finishedAt: null, playwrightReportKey: null };
    runRepo.findById.mockResolvedValue(run);
    runItemRepo.findByRunId.mockResolvedValue([
      { status: RunItemStatus.Passed },
      { status: RunItemStatus.Passed },
    ]);
    await service.completeRun('r1', { playwrightReportKey: 'runs/r1/report/index.html' });
    expect(run.status).toBe(RunStatus.Success);
    expect(run.playwrightReportKey).toBe('runs/r1/report/index.html');
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('completeRun — 모두 failed면 failed', async () => {
    const run = { id: 'r1', status: RunStatus.Running, finishedAt: null, playwrightReportKey: null };
    runRepo.findById.mockResolvedValue(run);
    runItemRepo.findByRunId.mockResolvedValue([
      { status: RunItemStatus.Failed },
      { status: RunItemStatus.Timedout },
    ]);
    await service.completeRun('r1', {});
    expect(run.status).toBe(RunStatus.Failed);
  });

  it('completeRun — 일부만 passed면 partial', async () => {
    const run = { id: 'r1', status: RunStatus.Running, finishedAt: null, playwrightReportKey: null };
    runRepo.findById.mockResolvedValue(run);
    runItemRepo.findByRunId.mockResolvedValue([
      { status: RunItemStatus.Passed },
      { status: RunItemStatus.Failed },
    ]);
    await service.completeRun('r1', {});
    expect(run.status).toBe(RunStatus.Partial);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @platform/admin-server test:unit -- event-ingest.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: `event-ingest.service.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import {
  RunStatus,
  RunItemStatus,
  type ReporterEventBatch,
  type RunItemStatusUpdateDto,
  type RunCompleteDto,
} from '@platform/shared';
import type { TestRunRepository } from '../repositories/test-run.repository.js';
import type { TestRunItemRepository } from '../repositories/test-run-item.repository.js';
import type { TestEventRepository } from '../repositories/test-event.repository.js';
import { ApiError } from '../app/api/_lib/error-handler.js';

export class EventIngestService {
  constructor(
    private readonly em: EntityManager,
    private readonly runs: TestRunRepository,
    private readonly runItems: TestRunItemRepository,
    private readonly events: TestEventRepository,
  ) {}

  async appendEvents(runId: string, batch: ReporterEventBatch): Promise<void> {
    const run = await this.runs.findById(runId);
    if (!run) throw new ApiError(404, `run ${runId} not found`, 'not_found');
    await this.events.insertBatch(runId, batch.events);
    await this.em.flush();
  }

  async updateItemStatus(
    runId: string,
    itemId: string,
    update: RunItemStatusUpdateDto,
  ): Promise<void> {
    const item = await this.runItems.findById(itemId);
    if (!item) throw new ApiError(404, `run item ${itemId} not found`, 'not_found');
    item.status = update.status;
    if (update.durationMs !== undefined) item.durationMs = update.durationMs;
    if (update.errorMessage !== undefined) item.errorMessage = update.errorMessage;
    if (this.isTerminal(update.status)) item.finishedAt = new Date();
    await this.em.flush();
  }

  async completeRun(runId: string, body: RunCompleteDto): Promise<void> {
    const run = await this.runs.findById(runId);
    if (!run) throw new ApiError(404, `run ${runId} not found`, 'not_found');
    const items = await this.runItems.findByRunId(runId);
    run.status = this.rollupStatus(items.map((i) => i.status));
    run.finishedAt = new Date();
    if (body.playwrightReportKey !== undefined) {
      run.playwrightReportKey = body.playwrightReportKey;
    }
    await this.em.flush();
  }

  private isTerminal(s: RunItemStatus): boolean {
    return (
      s === RunItemStatus.Passed ||
      s === RunItemStatus.Failed ||
      s === RunItemStatus.Skipped ||
      s === RunItemStatus.Timedout
    );
  }

  private rollupStatus(itemStatuses: RunItemStatus[]): RunStatus {
    const allPassed = itemStatuses.every((s) => s === RunItemStatus.Passed || s === RunItemStatus.Skipped);
    if (allPassed) return RunStatus.Success;
    const anyPassed = itemStatuses.some((s) => s === RunItemStatus.Passed);
    return anyPassed ? RunStatus.Partial : RunStatus.Failed;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @platform/admin-server test:unit -- event-ingest.service.test.ts`
Expected: PASS — 7개 케이스.

- [ ] **Step 5: 커밋**

```bash
git add packages/admin-server/src/services/event-ingest.service.ts packages/admin-server/tests/unit/event-ingest.service.test.ts
git commit -m "feat(admin-server): add EventIngestService with run rollup logic"
```

---

### Task 14: DI 컨테이너

**Files:**
- Create: `packages/admin-server/src/container.ts`

매 요청마다 `em.fork()` 후 서비스를 새로 조립한다 — MikroORM RequestContext 패턴의 단순화.

- [ ] **Step 1: `container.ts` 작성**

```ts
import type { EntityManager } from '@mikro-orm/mysql';
import { getOrm } from './db/orm.js';
import { TestCaseRepository } from './repositories/test-case.repository.js';
import { DeploymentRepository } from './repositories/deployment.repository.js';
import { TestFileRepository } from './repositories/test-file.repository.js';
import { TestCaseMappingRepository } from './repositories/test-case-mapping.repository.js';
import { TestRunRepository } from './repositories/test-run.repository.js';
import { TestRunItemRepository } from './repositories/test-run-item.repository.js';
import { TestEventRepository } from './repositories/test-event.repository.js';
import { TestCaseService } from './services/test-case.service.js';
import { DeploymentService } from './services/deployment.service.js';
import { RunService } from './services/run.service.js';
import { EventIngestService } from './services/event-ingest.service.js';
import {
  NoopRunQueuePublisher,
  type RunQueuePublisher,
} from './queue/run-queue-publisher.js';
import {
  NoopObjectStorageClient,
  type ObjectStorageClient,
} from './storage/object-storage-client.js';
import { NoopDeployTrigger, type DeployTrigger } from './deploy/deploy-trigger.js';

export interface AdminContainerOverrides {
  publisher?: RunQueuePublisher;
  storage?: ObjectStorageClient;
  trigger?: DeployTrigger;
  adminBaseUrl?: string;
}

let overrides: AdminContainerOverrides = {};

export function setContainerOverrides(o: AdminContainerOverrides): void {
  overrides = { ...overrides, ...o };
}

export function resetContainerOverrides(): void {
  overrides = {};
}

export interface AdminContainer {
  em: EntityManager;
  testCaseService: TestCaseService;
  deploymentService: DeploymentService;
  runService: RunService;
  eventIngestService: EventIngestService;
}

export async function getAdminContainer(): Promise<AdminContainer> {
  const orm = await getOrm();
  const em = orm.em.fork();
  const adminBaseUrl = overrides.adminBaseUrl ?? process.env.ADMIN_URL ?? 'http://admin:3000';
  const publisher = overrides.publisher ?? new NoopRunQueuePublisher();
  const storage = overrides.storage ?? new NoopObjectStorageClient();
  const trigger = overrides.trigger ?? new NoopDeployTrigger();

  const testCaseRepo = new TestCaseRepository(em);
  const deploymentRepo = new DeploymentRepository(em);
  const fileRepo = new TestFileRepository(em);
  const mappingRepo = new TestCaseMappingRepository(em);
  const runRepo = new TestRunRepository(em);
  const runItemRepo = new TestRunItemRepository(em);
  const eventRepo = new TestEventRepository(em);

  return {
    em,
    testCaseService: new TestCaseService(em, testCaseRepo, mappingRepo, deploymentRepo),
    deploymentService: new DeploymentService(em, deploymentRepo, fileRepo, trigger),
    runService: new RunService(
      em,
      deploymentRepo,
      testCaseRepo,
      mappingRepo,
      runRepo,
      runItemRepo,
      publisher,
      storage,
      adminBaseUrl,
    ),
    eventIngestService: new EventIngestService(em, runRepo, runItemRepo, eventRepo),
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add packages/admin-server/src/container.ts
git commit -m "feat(admin-server): add DI container with override hooks"
```

---

### Task 15: 공개 REST API — `/api/test-cases`

**Files:**
- Create: `packages/admin-server/src/app/api/test-cases/route.ts`
- Create: `packages/admin-server/src/app/api/test-cases/[id]/route.ts`

- [ ] **Step 1: `app/api/test-cases/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../container.js';
import { handleRoute } from '../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? undefined;
    const tag = url.searchParams.get('tag') ?? undefined;
    const activeOnly = url.searchParams.get('active_only') === 'true';
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined;
    const pageSize = url.searchParams.get('page_size') ? Number(url.searchParams.get('page_size')) : undefined;

    const container = await getAdminContainer();
    const result = await container.testCaseService.list({ q, tag, activeOnly, page, pageSize });
    return NextResponse.json(result);
  });
}
```

- [ ] **Step 2: `app/api/test-cases/[id]/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminContainer } from '../../../../container.js';
import { handleRoute, ApiError } from '../../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  params: z.record(z.unknown()).optional(),
  expected: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const dto = await container.testCaseService.getById(ctx.params.id);
    return NextResponse.json(dto);
  });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, 'invalid JSON', 'invalid_json');
    }
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'invalid patch payload', 'invalid_input');
    const container = await getAdminContainer();
    const dto = await container.testCaseService.patch(ctx.params.id, parsed.data);
    return NextResponse.json(dto);
  });
}
```

> import 경로 깊이는 `app/api/test-cases/[id]/route.ts` 기준 `../../../../container.js`. 상대 경로가 깊어지지만 `tsconfig`의 `paths.@/*`로 단축 가능 (선택).

- [ ] **Step 3: 커밋**

```bash
git add packages/admin-server/src/app/api/test-cases
git commit -m "feat(admin-server): add /api/test-cases routes (list, get, patch)"
```

---

### Task 16: 공개 REST API — `/api/test-cases/:id/runs`, `/api/runnable-test-cases`

**Files:**
- Create: `packages/admin-server/src/app/api/test-cases/[id]/runs/route.ts`
- Create: `packages/admin-server/src/app/api/runnable-test-cases/route.ts`

- [ ] **Step 1: `[id]/runs/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../../../container.js';
import { handleRoute } from '../../../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const items = await container.runService.listRunsForTestCase(ctx.params.id);
    return NextResponse.json({ items });
  });
}
```

- [ ] **Step 2: `runnable-test-cases/route.ts` 작성**

```ts
import { NextResponse } from 'next/server';
import { getAdminContainer } from '../../../container.js';
import { handleRoute } from '../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const items = await container.testCaseService.listRunnable();
    return NextResponse.json({ items });
  });
}
```

- [ ] **Step 3: 커밋**

```bash
git add packages/admin-server/src/app/api/test-cases/\[id\]/runs packages/admin-server/src/app/api/runnable-test-cases
git commit -m "feat(admin-server): add /api/test-cases/:id/runs and /api/runnable-test-cases"
```

---

### Task 17: 공개 REST API — `/api/deployments`

**Files:**
- Create: `packages/admin-server/src/app/api/deployments/route.ts`
- Create: `packages/admin-server/src/app/api/deployments/[id]/route.ts`
- Create: `packages/admin-server/src/app/api/deployments/[id]/test-files/route.ts`

- [ ] **Step 1: `deployments/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { DeploymentStatus } from '@platform/shared';
import { getAdminContainer } from '../../../container.js';
import { handleRoute, ApiError } from '../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({ gitRef: z.string().min(1) });

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined;
    const validStatus = status && (Object.values(DeploymentStatus) as string[]).includes(status)
      ? (status as DeploymentStatus)
      : undefined;
    const container = await getAdminContainer();
    const result = await container.deploymentService.list({ status: validStatus, page });
    return NextResponse.json(result);
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, 'invalid JSON', 'invalid_json');
    }
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'gitRef required', 'invalid_input');
    const container = await getAdminContainer();
    const dto = await container.deploymentService.create(parsed.data);
    return NextResponse.json(dto, { status: 202 });
  });
}
```

- [ ] **Step 2: `deployments/[id]/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../../container.js';
import { handleRoute } from '../../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const dto = await container.deploymentService.getById(ctx.params.id);
    return NextResponse.json(dto);
  });
}
```

- [ ] **Step 3: `deployments/[id]/test-files/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../../../container.js';
import { handleRoute } from '../../../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const items = await container.deploymentService.listTestFiles(ctx.params.id);
    return NextResponse.json({ items });
  });
}
```

- [ ] **Step 4: 커밋**

```bash
git add packages/admin-server/src/app/api/deployments
git commit -m "feat(admin-server): add /api/deployments routes"
```

---

### Task 18: 공개 REST API — `/api/runs`

**Files:**
- Create: `packages/admin-server/src/app/api/runs/route.ts`
- Create: `packages/admin-server/src/app/api/runs/[id]/route.ts`
- Create: `packages/admin-server/src/app/api/runs/[id]/report/route.ts`

- [ ] **Step 1: `runs/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminContainer } from '../../../container.js';
import { handleRoute, ApiError } from '../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  testCaseIds: z.array(z.string().min(1)).min(1),
  paramOverrides: z.record(z.record(z.unknown())).optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    const url = new URL(req.url);
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined;
    const container = await getAdminContainer();
    const result = await container.runService.list({ page });
    return NextResponse.json(result);
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, 'invalid JSON', 'invalid_json');
    }
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'invalid run payload', 'invalid_input');
    const container = await getAdminContainer();
    const dto = await container.runService.create(parsed.data);
    return NextResponse.json(dto, { status: 202 });
  });
}
```

- [ ] **Step 2: `runs/[id]/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../../container.js';
import { handleRoute } from '../../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const result = await container.runService.getById(ctx.params.id);
    return NextResponse.json(result);
  });
}
```

- [ ] **Step 3: `runs/[id]/report/route.ts` 작성**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../../../container.js';
import { handleRoute } from '../../../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const url = await container.runService.getReportUrl(ctx.params.id);
    return NextResponse.json({ url });
  });
}
```

- [ ] **Step 4: 커밋**

```bash
git add packages/admin-server/src/app/api/runs
git commit -m "feat(admin-server): add /api/runs routes"
```

---

### Task 19: 통합 테스트 — testcontainers MySQL 셋업

**Files:**
- Create: `packages/admin-server/tests/integration/setup-mysql.ts`

testcontainers로 MySQL 8.0 컨테이너를 띄우고, ORM을 그 URL로 초기화 + 마이그레이션 실행 후 EM을 반환. 각 테스트 파일은 `beforeAll`에서 한 번 컨테이너 기동.

- [ ] **Step 1: `setup-mysql.ts` 작성**

```ts
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
  // 통합 테스트는 vitest(esbuild) 환경에서 돈다. MikroORM의 ts glob 기반 마이그레이션 발견은
  // 환경에 따라 실패할 수 있으므로 SchemaGenerator로 엔티티 메타데이터에서 직접 스키마를 만든다.
  // 운영 환경(빌드된 dist)에서는 마이그레이션이 정상 적용된다.
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
```

- [ ] **Step 2: 커밋**

```bash
git add packages/admin-server/tests/integration/setup-mysql.ts
git commit -m "test(admin-server): add testcontainers MySQL harness"
```

---

### Task 20: 통합 테스트 — `/api/test-cases`

**Files:**
- Create: `packages/admin-server/tests/integration/test-cases.api.test.ts`

Next.js 라우트 핸들러를 직접 import해서 호출 (서버 기동 없이 단위 호출). `NextRequest`는 `Request`로 캐스팅 가능.

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { startMysqlHarness, type MysqlHarness } from './setup-mysql.js';
import { getAdminContainer } from '../../src/container.js';
import { TestCase } from '../../src/entities/test-case.entity.js';

let harness: MysqlHarness;

beforeAll(async () => {
  harness = await startMysqlHarness();
});

afterAll(async () => {
  await harness.stop();
});

beforeEach(async () => {
  await harness.reset();
});

async function seedTestCase(id: string, name: string, tags: string[] = []): Promise<void> {
  const em = harness.orm.em.fork();
  const tc = em.create(TestCase, { id, name, params: {}, expected: {}, tags, autoCreated: true });
  await em.persistAndFlush(tc);
}

describe('GET /api/test-cases', () => {
  it('빈 DB는 빈 목록 반환', async () => {
    const { GET } = await import('../../src/app/api/test-cases/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });

  it('seed된 TC를 isActive=false로 반환 (성공 배포 없음)', async () => {
    await seedTestCase('TC-1', 'cart');
    const { GET } = await import('../../src/app/api/test-cases/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases'));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe('TC-1');
    expect(body.items[0].isActive).toBe(false);
  });

  it('q 파라미터로 ID/name 필터', async () => {
    await seedTestCase('TC-1', 'cart');
    await seedTestCase('TC-2', 'checkout');
    const { GET } = await import('../../src/app/api/test-cases/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases?q=cart'));
    const body = await res.json();
    expect(body.items.map((t: any) => t.id)).toEqual(['TC-1']);
  });
});

describe('GET /api/test-cases/:id', () => {
  it('존재하면 상세 반환', async () => {
    await seedTestCase('TC-1', 'cart');
    const { GET } = await import('../../src/app/api/test-cases/[id]/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases/TC-1'), { params: { id: 'TC-1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe('TC-1');
  });

  it('없으면 404', async () => {
    const { GET } = await import('../../src/app/api/test-cases/[id]/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases/X'), { params: { id: 'X' } });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/test-cases/:id', () => {
  it('이름 갱신', async () => {
    await seedTestCase('TC-1', 'old');
    const { PATCH } = await import('../../src/app/api/test-cases/[id]/route.js');
    const req = new NextRequest('http://localhost/api/test-cases/TC-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'new' }),
    });
    const res = await PATCH(req, { params: { id: 'TC-1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('new');
  });

  it('잘못된 payload는 400', async () => {
    await seedTestCase('TC-1', 'x');
    const { PATCH } = await import('../../src/app/api/test-cases/[id]/route.js');
    const req = new NextRequest('http://localhost/api/test-cases/TC-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: 'nope' }),
    });
    const res = await PATCH(req, { params: { id: 'TC-1' } });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `pnpm --filter @platform/admin-server test:integration -- test-cases.api.test.ts`
Expected: PASS — 7개 케이스. (첫 실행은 testcontainers MySQL 이미지 다운로드로 1~2분 소요 가능.)

- [ ] **Step 3: 커밋**

```bash
git add packages/admin-server/tests/integration/test-cases.api.test.ts
git commit -m "test(admin-server): add /api/test-cases integration tests"
```

---

### Task 21: 통합 테스트 — `/api/deployments`

**Files:**
- Create: `packages/admin-server/tests/integration/deployments.api.test.ts`

`POST /api/deployments`는 trigger를 호출하므로 `NoopDeployTrigger`로 override 후 호출 기록을 검증한다.

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { startMysqlHarness, type MysqlHarness } from './setup-mysql.js';
import {
  setContainerOverrides,
  resetContainerOverrides,
} from '../../src/container.js';
import { NoopDeployTrigger } from '../../src/deploy/deploy-trigger.js';
import { Deployment } from '../../src/entities/deployment.entity.js';
import { DeploymentStatus } from '@platform/shared';

let harness: MysqlHarness;
let trigger: NoopDeployTrigger;

beforeAll(async () => {
  harness = await startMysqlHarness();
});

afterAll(async () => {
  await harness.stop();
});

beforeEach(async () => {
  await harness.reset();
  trigger = new NoopDeployTrigger();
  setContainerOverrides({ trigger });
});

describe('POST /api/deployments', () => {
  it('row INSERT + trigger 호출 + 202 + DTO 반환', async () => {
    const { POST } = await import('../../src/app/api/deployments/route.js');
    const req = new NextRequest('http://localhost/api/deployments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gitRef: 'main' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.gitRef).toBe('main');
    expect(body.status).toBe(DeploymentStatus.Pending);
    expect(trigger.triggers).toHaveLength(1);
    expect(trigger.triggers[0].deploymentId).toBe(body.id);

    const em = harness.orm.em.fork();
    const dep = await em.findOne(Deployment, { id: body.id });
    expect(dep?.status).toBe(DeploymentStatus.Pending);
  });

  it('gitRef 빈 문자열은 400', async () => {
    const { POST } = await import('../../src/app/api/deployments/route.js');
    const req = new NextRequest('http://localhost/api/deployments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gitRef: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(trigger.triggers).toHaveLength(0);
  });

  afterAll(() => resetContainerOverrides());
});

describe('GET /api/deployments', () => {
  it('seed된 deployment 조회', async () => {
    const em = harness.orm.em.fork();
    const dep = em.create(Deployment, { gitRef: 'main', status: DeploymentStatus.Success });
    await em.persistAndFlush(dep);

    const { GET } = await import('../../src/app/api/deployments/route.js');
    const res = await GET(new NextRequest('http://localhost/api/deployments'));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].status).toBe(DeploymentStatus.Success);
  });

  it('status 필터', async () => {
    const em = harness.orm.em.fork();
    em.create(Deployment, { gitRef: 'a', status: DeploymentStatus.Success });
    em.create(Deployment, { gitRef: 'b', status: DeploymentStatus.Failed });
    await em.flush();

    const { GET } = await import('../../src/app/api/deployments/route.js');
    const res = await GET(new NextRequest('http://localhost/api/deployments?status=success'));
    const body = await res.json();
    expect(body.total).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `pnpm --filter @platform/admin-server test:integration -- deployments.api.test.ts`
Expected: PASS — 4개 케이스.

- [ ] **Step 3: 커밋**

```bash
git add packages/admin-server/tests/integration/deployments.api.test.ts
git commit -m "test(admin-server): add /api/deployments integration tests"
```

---

### Task 22: 통합 테스트 — `/api/runs`

**Files:**
- Create: `packages/admin-server/tests/integration/runs.api.test.ts`

`POST /api/runs`는 ① 매핑 검증 ② snapshot 박제 ③ 큐 publish 검증이 모두 필요.

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { startMysqlHarness, type MysqlHarness } from './setup-mysql.js';
import {
  setContainerOverrides,
  resetContainerOverrides,
} from '../../src/container.js';
import { NoopRunQueuePublisher } from '../../src/queue/run-queue-publisher.js';
import { Deployment } from '../../src/entities/deployment.entity.js';
import { TestCase } from '../../src/entities/test-case.entity.js';
import { TestFile } from '../../src/entities/test-file.entity.js';
import { TestCaseMapping } from '../../src/entities/test-case-mapping.entity.js';
import { TestRun } from '../../src/entities/test-run.entity.js';
import { TestRunItem } from '../../src/entities/test-run-item.entity.js';
import {
  DeploymentStatus,
  RunStatus,
  RunItemStatus,
} from '@platform/shared';

let harness: MysqlHarness;
let publisher: NoopRunQueuePublisher;

beforeAll(async () => {
  harness = await startMysqlHarness();
});

afterAll(async () => {
  await harness.stop();
  resetContainerOverrides();
});

beforeEach(async () => {
  await harness.reset();
  publisher = new NoopRunQueuePublisher();
  setContainerOverrides({ publisher, adminBaseUrl: 'http://admin:3000' });
});

async function seedDeploymentWithTc(): Promise<{ depId: string; tcId: string; fileId: string }> {
  const em = harness.orm.em.fork();
  const dep = em.create(Deployment, { gitRef: 'main', status: DeploymentStatus.Success, finishedAt: new Date() });
  const tc = em.create(TestCase, {
    id: 'TC-1',
    name: 'cart',
    params: { qty: 1 },
    expected: { count: 1 },
    tags: [],
    autoCreated: true,
  });
  const file = em.create(TestFile, { deployment: dep, sourcePath: 'cart.spec.ts', bundleKey: 'deployments/x/files/cart.spec.js' });
  em.create(TestCaseMapping, { deployment: dep, testCase: tc, testFile: file });
  await em.flush();
  return { depId: dep.id, tcId: tc.id, fileId: file.id };
}

describe('POST /api/runs', () => {
  it('성공 — run + items INSERT + snapshot 박제 + 큐 publish', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const req = new NextRequest('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseIds: [tcId] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe(RunStatus.Queued);

    const em = harness.orm.em.fork();
    const run = await em.findOne(TestRun, { id: body.id });
    expect(run?.requestedTestCaseIds).toEqual([tcId]);

    const items = await em.find(TestRunItem, { testRun: body.id });
    expect(items).toHaveLength(1);
    expect(items[0].paramsSnapshot).toEqual({ qty: 1 });
    expect(items[0].expectedSnapshot).toEqual({ count: 1 });
    expect(items[0].status).toBe(RunItemStatus.Pending);

    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0].testCaseId).toBe(tcId);
    expect(publisher.published[0].adminBaseUrl).toBe('http://admin:3000');
  });

  it('paramOverrides가 snapshot에 머지됨', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const req = new NextRequest('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseIds: [tcId], paramOverrides: { [tcId]: { qty: 9 } } }),
    });
    const res = await POST(req);
    const body = await res.json();
    const em = harness.orm.em.fork();
    const items = await em.find(TestRunItem, { testRun: body.id });
    expect(items[0].paramsSnapshot).toEqual({ qty: 9 });
  });

  it('성공 배포 없으면 409', async () => {
    const em = harness.orm.em.fork();
    em.create(TestCase, { id: 'TC-1', name: 'x', params: {}, expected: {}, tags: [], autoCreated: true });
    await em.flush();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const req = new NextRequest('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseIds: ['TC-1'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(publisher.published).toHaveLength(0);
  });

  it('매핑 없는 TC는 400', async () => {
    await seedDeploymentWithTc();
    const em = harness.orm.em.fork();
    em.create(TestCase, { id: 'TC-2', name: 'orphan', params: {}, expected: {}, tags: [], autoCreated: true });
    await em.flush();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const req = new NextRequest('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseIds: ['TC-2'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(publisher.published).toHaveLength(0);
  });
});

describe('GET /api/runs/:id', () => {
  it('items 포함 조회', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const createRes = await POST(
      new NextRequest('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ testCaseIds: [tcId] }),
      }),
    );
    const created = await createRes.json();

    const { GET } = await import('../../src/app/api/runs/[id]/route.js');
    const res = await GET(new NextRequest(`http://localhost/api/runs/${created.id}`), {
      params: { id: created.id },
    });
    const body = await res.json();
    expect(body.run.id).toBe(created.id);
    expect(body.items).toHaveLength(1);
  });

  it('없으면 404', async () => {
    const { GET } = await import('../../src/app/api/runs/[id]/route.js');
    const res = await GET(new NextRequest('http://localhost/api/runs/x'), { params: { id: 'x' } });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/runs/:id/report', () => {
  it('reportKey 없으면 404', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const create = await POST(
      new NextRequest('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ testCaseIds: [tcId] }),
      }),
    );
    const created = await create.json();

    const { GET } = await import('../../src/app/api/runs/[id]/report/route.js');
    const res = await GET(new NextRequest(`http://localhost/api/runs/${created.id}/report`), {
      params: { id: created.id },
    });
    expect(res.status).toBe(404);
  });

  it('reportKey 있으면 noop URL 반환 (Phase 3a 기본)', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const create = await POST(
      new NextRequest('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ testCaseIds: [tcId] }),
      }),
    );
    const created = await create.json();
    const em = harness.orm.em.fork();
    const run = await em.findOneOrFail(TestRun, { id: created.id });
    run.playwrightReportKey = `runs/${created.id}/report/index.html`;
    await em.flush();

    const { GET } = await import('../../src/app/api/runs/[id]/report/route.js');
    const res = await GET(new NextRequest(`http://localhost/api/runs/${created.id}/report`), {
      params: { id: created.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('noop://');
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `pnpm --filter @platform/admin-server test:integration -- runs.api.test.ts`
Expected: PASS — 7개 케이스.

- [ ] **Step 3: 커밋**

```bash
git add packages/admin-server/tests/integration/runs.api.test.ts
git commit -m "test(admin-server): add /api/runs integration tests"
```

---

### Task 23: 루트 vitest config 조정 + README 업데이트

**Files:**
- Modify: 루트 `vitest.config.ts`
- Modify: 루트 `README.md`

루트 `pnpm test`가 admin-server 통합 테스트를 직접 돌리지는 않는다 (DB 컨테이너 기동 비용). 패키지 단위 테스트만 포함.

- [ ] **Step 1: 루트 `vitest.config.ts` 확인**

이미 `packages/**/tests/**/*.test.ts`로 매칭되므로 admin-server의 unit 테스트는 자동 포함되지만 integration도 함께 잡히게 된다. Integration은 별도 명령어로만 돌리도록 exclude를 추가.

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/tests/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/integration/**'],
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
```

- [ ] **Step 2: 루트 `README.md`에 Phase 3a 섹션 추가**

기존 README 끝에 추가:

````markdown
## Phase 3a: admin-server core

```bash
# Unit tests (mock 기반, 빠름)
pnpm --filter @platform/admin-server test:unit

# Integration tests (testcontainers MySQL — 첫 실행은 이미지 다운로드 시간 소요)
pnpm --filter @platform/admin-server test:integration

# Type check
pnpm --filter @platform/admin-server exec tsc --noEmit -p tsconfig.json
```

`POST /api/deployments`와 `POST /api/runs`는 외부 의존(deploy-server, RabbitMQ)을 noop stub으로 대체해 단독 동작한다. 실제 연결은 Phase 3b에서 추가.
````

- [ ] **Step 3: 루트 단위 테스트 전체 통과 확인**

Run: `pnpm test`
Expected: shared / playwright-lib / admin-server의 unit 테스트 모두 PASS, integration은 제외됨.

- [ ] **Step 4: admin-server 통합 테스트도 명시적으로 통과 확인**

Run: `pnpm --filter @platform/admin-server test:integration`
Expected: 모든 통합 테스트 PASS.

- [ ] **Step 5: 커밋**

```bash
git add vitest.config.ts README.md
git commit -m "chore: exclude admin-server integration tests from default vitest run"
```

---

### Task 24: Phase 3a 마무리 — 빌드/타입 검증 + 최종 커밋

- [ ] **Step 1: 전체 워크스페이스 빌드 확인**

Run: `pnpm --filter @platform/admin-server exec tsc --noEmit -p tsconfig.json`
Expected: 타입 에러 없음.

Run: `pnpm --filter @platform/shared build && pnpm --filter @platform/playwright-lib build`
Expected: 두 패키지 모두 빌드 성공 (회귀 없음 확인).

- [ ] **Step 2: 린트**

Run: `pnpm lint`
Expected: 에러 없음 (warning은 OK).

- [ ] **Step 3: 전체 테스트 (unit + integration)**

Run: `pnpm test && pnpm --filter @platform/admin-server test:integration`
Expected: 모두 PASS.

- [ ] **Step 4: 변경 요약 커밋 (필요 시)**

빌드/린트로 인한 자동 수정만 남았다면:

```bash
git status
# 변경이 있다면:
git add -A
git commit -m "chore(admin-server): finalize phase 3a build/lint cleanups"
```

변경이 없으면 빈 커밋은 하지 않는다.

---

## Phase 3a 완료 기준

- 7개 엔티티 + 초기 마이그레이션이 testcontainers MySQL에서 성공적으로 적용된다.
- 4개 서비스(`TestCaseService`, `DeploymentService`, `RunService`, `EventIngestService`)에 대한 단위 테스트가 모두 통과한다.
- 공개 REST API 9개 라우트가 통합 테스트에서 정상 동작한다 (외부 의존은 noop stub).
- `RunService.create()`가 스펙 §6.2의 핵심 동작(매핑 검증 + snapshot 박제 + 큐 publish)을 수행한다.
- `EventIngestService.completeRun()`이 items 상태를 기반으로 run.status를 success/partial/failed로 롤업한다.
- Phase 3b에서 `RunQueuePublisher`/`ObjectStorageClient`/`DeployTrigger`의 실제 구현으로 stub만 교체하면 외부 시스템과 연동된다.

Phase 3b에서 추가될 항목 (참고):

- `app/api/internal/*` 6개 라우트 + `middleware.ts` (Host + `X-Internal-Token` 가드)
- `DeploymentService.upsertMappings()` — 파일 + TC upsert + mappings 단일 트랜잭션
- `queue/amqp-publisher.ts` — amqplib 기반 실 publisher
- `storage/minio-client.ts` — MinIO presigned URL 실 구현
- `deploy/http-deploy-trigger.ts` — deploy-server HTTP 호출 실 구현
- `app/api/runs/[id]/events/stream/route.ts` — SSE 스트림
- `src/app/(ui)/*` — 최소 UI
- `Dockerfile` + `docker-compose.yml` admin 서비스 추가
