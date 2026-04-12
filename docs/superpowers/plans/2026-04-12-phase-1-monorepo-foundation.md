# Phase 1: 모노레포 기반 + shared 패키지 + Docker Compose 골격

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이후 모든 Phase가 올라탈 모노레포 뼈대를 세운다. pnpm workspaces, TypeScript, Vitest, ESLint/Prettier가 동작하고, `shared` 패키지의 타입·상수가 빌드되며, Docker Compose로 인프라(MySQL, RabbitMQ, MinIO)가 기동된다.

**Architecture:** pnpm workspaces 모노레포. `packages/shared`는 런타임 의존성 없는 타입·상수·DTO 전용 패키지. 인프라 3종(MySQL, RabbitMQ, MinIO)은 Docker Compose로 관리, 각 서비스 패키지의 Dockerfile은 이후 Phase에서 추가.

**Tech Stack:** Node.js 20, TypeScript 5.x, pnpm 9.x, Vitest, ESLint + Prettier, Docker Compose v2, MySQL 8.0, RabbitMQ 3-management, MinIO.

---

## 파일 구조

Phase 1에서 생성/수정하는 파일:

- Create: `package.json` — 루트 workspace 매니페스트
- Create: `pnpm-workspace.yaml` — pnpm workspace 설정
- Create: `tsconfig.base.json` — 공용 TS 설정
- Create: `.nvmrc` — Node 버전 고정
- Create: `.editorconfig` — 에디터 공통 설정
- Create: `.prettierrc.json`, `.prettierignore`
- Create: `.eslintrc.cjs`, `.eslintignore`
- Create: `vitest.config.ts` — 루트 Vitest 설정 (패키지별로 override 가능)
- Create: `.gitignore` 수정 (기존 파일 존재)
- Create: `.env.example` — 루트 환경변수 템플릿
- Create: `docker-compose.yml` — MySQL/RabbitMQ/MinIO만 (서비스 3종은 이후 Phase)
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/constants/statuses.ts`
- Create: `packages/shared/src/constants/event-types.ts`
- Create: `packages/shared/src/constants/index.ts`
- Create: `packages/shared/src/events/reporter-events.ts`
- Create: `packages/shared/src/events/queue-messages.ts`
- Create: `packages/shared/src/events/index.ts`
- Create: `packages/shared/src/dto/test-case.ts`
- Create: `packages/shared/src/dto/deployment.ts`
- Create: `packages/shared/src/dto/run.ts`
- Create: `packages/shared/src/dto/index.ts`
- Create: `packages/shared/tests/constants.test.ts`
- Create: `packages/shared/tests/events.test.ts`
- Create: `README.md` — 기동 순서 (최소 버전)

---

### Task 1: pnpm 및 Node 버전 고정

**Files:**
- Create: `.nvmrc`
- Create: `.editorconfig`

- [ ] **Step 1: `.nvmrc` 작성**

```
20
```

- [ ] **Step 2: `.editorconfig` 작성**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 3: pnpm 사용 가능 확인**

Run: `corepack enable && corepack prepare pnpm@9 --activate && pnpm --version`
Expected: `9.x.x` 출력

- [ ] **Step 4: 커밋**

```bash
git add .nvmrc .editorconfig
git commit -m "chore: pin node 20 and add editor config"
```

---

### Task 2: 루트 `package.json` 및 pnpm workspace 설정

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: 루트 `package.json` 작성**

```json
{
  "name": "playwright-test-platform-demo",
  "private": true,
  "version": "0.0.0",
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "build": "pnpm -r --filter ./packages/** build",
    "test": "pnpm -r --filter ./packages/** test",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: `pnpm-workspace.yaml` 작성**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: 의존성 설치**

Run: `pnpm install`
Expected: `node_modules/`와 `pnpm-lock.yaml`이 생성됨. 에러 없이 종료.

- [ ] **Step 4: 커밋**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: initialize pnpm workspace with node 20 toolchain"
```

---

### Task 3: TypeScript 공용 설정

**Files:**
- Create: `tsconfig.base.json`

- [ ] **Step 1: `tsconfig.base.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

참고: `experimentalDecorators`/`emitDecoratorMetadata`는 이후 Phase에서 MikroORM·NestJS가 사용함. Phase 1에서도 켜둔다(해가 없음).

- [ ] **Step 2: 커밋**

```bash
git add tsconfig.base.json
git commit -m "chore: add shared tsconfig base"
```

---

### Task 4: Prettier 설정

**Files:**
- Create: `.prettierrc.json`
- Create: `.prettierignore`

- [ ] **Step 1: `.prettierrc.json` 작성**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 2: `.prettierignore` 작성**

```
node_modules
dist
build
.next
coverage
pnpm-lock.yaml
```

- [ ] **Step 3: Prettier 동작 확인**

Run: `pnpm exec prettier --check .`
Expected: 에러 없이 종료 (변경할 파일이 없거나, 있더라도 실패하지 않음). 만약 기존 파일 포맷 문제로 실패하면 `pnpm exec prettier --write .` 후 다시 실행.

- [ ] **Step 4: 커밋**

```bash
git add .prettierrc.json .prettierignore
git commit -m "chore: configure prettier"
```

---

### Task 5: ESLint 설정

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.eslintignore`

- [ ] **Step 1: `.eslintrc.cjs` 작성**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  ignorePatterns: ['dist', 'build', '.next', 'coverage', 'node_modules'],
};
```

- [ ] **Step 2: `.eslintignore` 작성**

```
node_modules
dist
build
.next
coverage
pnpm-lock.yaml
```

- [ ] **Step 3: Lint 동작 확인**

Run: `pnpm lint`
Expected: 에러 없이 종료 (현재 대상 파일이 없어 통과).

- [ ] **Step 4: 커밋**

```bash
git add .eslintrc.cjs .eslintignore
git commit -m "chore: configure eslint"
```

---

### Task 6: Vitest 루트 설정

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: `vitest.config.ts` 작성**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/tests/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    passWithNoTests: true,
  },
});
```

- [ ] **Step 2: Vitest 동작 확인**

Run: `pnpm exec vitest run`
Expected: "No test files found" 관련 경고만 뜨고 정상 종료 (exit code 0). `passWithNoTests: true` 설정 때문에 실패하지 않음.

- [ ] **Step 3: 커밋**

```bash
git add vitest.config.ts
git commit -m "chore: configure vitest at repo root"
```

---

### Task 7: `.gitignore` 보강

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 현재 `.gitignore` 내용 확인**

Run: `cat .gitignore`
Expected: 기존 내용이 존재.

- [ ] **Step 2: `.gitignore` 전체를 다음 내용으로 교체**

```
# Node
node_modules/
dist/
build/
.next/
coverage/
*.tsbuildinfo

# Env
.env
.env.local
.env.*.local
!.env.example

# MikroORM
migrations/.snapshot-*

# Logs
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json

# Docker local volume data
data/
```

- [ ] **Step 3: 커밋**

```bash
git add .gitignore
git commit -m "chore: expand gitignore for node, env, docker"
```

---

### Task 8: `.env.example` 작성

**Files:**
- Create: `.env.example`

- [ ] **Step 1: `.env.example` 작성**

```bash
# MySQL
MYSQL_ROOT_PASSWORD=root
MYSQL_USER=platform
MYSQL_PASSWORD=platform
MYSQL_DATABASE=platform
DATABASE_URL=mysql://platform:platform@mysql:3306/platform

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672

# MinIO
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=platform
MINIO_SECRET_KEY=platform_secret
MINIO_BUCKET=test-platform

# Admin/Deploy inter-service URLs
ADMIN_URL=http://admin:3000
DEPLOY_URL=http://deploy:4000

# SUT (host webapp)
SUT_BASE_URL=http://host.docker.internal:8080

# Git source repo
GIT_REPO_URL=
GIT_REPO_BRANCH=main
GIT_AUTH_TOKEN=

# Runtime control
MAX_CONCURRENT=2
REPORTER_CHUNK_SIZE=50
REPORTER_FLUSH_INTERVAL_MS=2000

# Internal API protection (admin/deploy/runner 공유)
INTERNAL_API_TOKEN=change-me-to-a-long-random-string
```

- [ ] **Step 2: 커밋**

```bash
git add .env.example
git commit -m "chore: add .env.example template"
```

---

### Task 9: Docker Compose 인프라 정의 (MySQL/RabbitMQ/MinIO만)

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: `docker-compose.yml` 작성**

```yaml
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
    command: >
      --default-authentication-plugin=caching_sha2_password
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --default-time-zone=+00:00
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-u", "root", "-p${MYSQL_ROOT_PASSWORD}"]
      interval: 5s
      timeout: 3s
      retries: 10

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  mysql-data:
  rabbitmq-data:
  minio-data:
```

- [ ] **Step 2: `.env` 생성 (로컬 테스트용, 커밋 제외)**

Run: `cp .env.example .env`
Expected: `.env` 파일이 생성됨. (`.gitignore`에 의해 추적 안됨.)

- [ ] **Step 3: 인프라 기동**

Run: `docker compose up -d`
Expected: mysql/rabbitmq/minio 컨테이너 3개가 실행되고 healthy 상태로 진입.

- [ ] **Step 4: healthcheck 통과 확인**

Run: `docker compose ps`
Expected: 세 서비스 모두 `State=running`, `Health=healthy` (healthy까지 30초가량 걸릴 수 있음).

- [ ] **Step 5: 로그 이상 여부 확인**

Run: `docker compose logs --tail=20 mysql rabbitmq minio`
Expected: Error/Fatal 메시지 없음.

- [ ] **Step 6: 인프라 정지**

Run: `docker compose down`
Expected: 컨테이너 종료. 볼륨은 유지됨.

- [ ] **Step 7: 커밋**

```bash
git add docker-compose.yml
git commit -m "chore: docker compose for mysql, rabbitmq, minio"
```

---

### Task 10: `packages/shared` 패키지 뼈대

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: `packages/shared/package.json` 작성**

```json
{
  "name": "@platform/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "eslint src --ext .ts"
  }
}
```

- [ ] **Step 2: `packages/shared/tsconfig.json` 작성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "tests"]
}
```

- [ ] **Step 3: 엔트리 파일 `src/index.ts` 빈 export로 작성**

```ts
export {};
```

- [ ] **Step 4: 빌드 확인**

Run: `pnpm install && pnpm --filter @platform/shared build`
Expected: `packages/shared/dist/index.js`와 `index.d.ts` 생성.

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/package.json packages/shared/tsconfig.json packages/shared/src/index.ts pnpm-lock.yaml
git commit -m "feat(shared): scaffold package with build pipeline"
```

---

### Task 11: `shared` 상수 — statuses

**Files:**
- Create: `packages/shared/src/constants/statuses.ts`
- Test: `packages/shared/tests/constants.test.ts`

- [ ] **Step 1: 실패 테스트 작성 — `tests/constants.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  DeploymentStatus,
  RunStatus,
  RunItemStatus,
} from '../src/constants/statuses.js';

describe('statuses', () => {
  it('DeploymentStatus covers full pipeline lifecycle', () => {
    const values = Object.values(DeploymentStatus);
    expect(values).toEqual([
      'pending',
      'cloning',
      'bundling',
      'uploading',
      'mapping',
      'success',
      'failed',
    ]);
  });

  it('RunStatus has queued/running/success/failed/partial', () => {
    const values = Object.values(RunStatus);
    expect(values).toEqual(['queued', 'running', 'success', 'failed', 'partial']);
  });

  it('RunItemStatus has pending/running/passed/failed/skipped/timedout', () => {
    const values = Object.values(RunItemStatus);
    expect(values).toEqual([
      'pending',
      'running',
      'passed',
      'failed',
      'skipped',
      'timedout',
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @platform/shared test`
Expected: FAIL — `Cannot find module '../src/constants/statuses.js'` 또는 유사한 에러.

- [ ] **Step 3: `src/constants/statuses.ts` 작성**

```ts
export const DeploymentStatus = {
  Pending: 'pending',
  Cloning: 'cloning',
  Bundling: 'bundling',
  Uploading: 'uploading',
  Mapping: 'mapping',
  Success: 'success',
  Failed: 'failed',
} as const;
export type DeploymentStatus = (typeof DeploymentStatus)[keyof typeof DeploymentStatus];

export const RunStatus = {
  Queued: 'queued',
  Running: 'running',
  Success: 'success',
  Failed: 'failed',
  Partial: 'partial',
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const RunItemStatus = {
  Pending: 'pending',
  Running: 'running',
  Passed: 'passed',
  Failed: 'failed',
  Skipped: 'skipped',
  Timedout: 'timedout',
} as const;
export type RunItemStatus = (typeof RunItemStatus)[keyof typeof RunItemStatus];
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @platform/shared test`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/constants/statuses.ts packages/shared/tests/constants.test.ts
git commit -m "feat(shared): add deployment/run/item status enums"
```

---

### Task 12: `shared` 상수 — event types

**Files:**
- Create: `packages/shared/src/constants/event-types.ts`
- Create: `packages/shared/src/constants/index.ts`
- Modify: `packages/shared/tests/constants.test.ts`

- [ ] **Step 1: 실패 테스트 추가 — `tests/constants.test.ts` 뒤에 append**

기존 `constants.test.ts` 끝에 다음을 추가:

```ts
import { ReporterEventType } from '../src/constants/event-types.js';

describe('ReporterEventType', () => {
  it('covers test_begin/test_end/step_begin/step_end/stdout/stderr', () => {
    const values = Object.values(ReporterEventType);
    expect(values).toEqual([
      'test_begin',
      'test_end',
      'step_begin',
      'step_end',
      'stdout',
      'stderr',
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @platform/shared test`
Expected: FAIL — `Cannot find module '../src/constants/event-types.js'`.

- [ ] **Step 3: `src/constants/event-types.ts` 작성**

```ts
export const ReporterEventType = {
  TestBegin: 'test_begin',
  TestEnd: 'test_end',
  StepBegin: 'step_begin',
  StepEnd: 'step_end',
  Stdout: 'stdout',
  Stderr: 'stderr',
} as const;
export type ReporterEventType = (typeof ReporterEventType)[keyof typeof ReporterEventType];
```

- [ ] **Step 4: `src/constants/index.ts` 작성**

```ts
export * from './statuses.js';
export * from './event-types.js';
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @platform/shared test`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/constants/event-types.ts packages/shared/src/constants/index.ts packages/shared/tests/constants.test.ts
git commit -m "feat(shared): add reporter event type constants"
```

---

### Task 13: `shared` 이벤트 — reporter events

**Files:**
- Create: `packages/shared/src/events/reporter-events.ts`
- Create: `packages/shared/tests/events.test.ts`

- [ ] **Step 1: 실패 테스트 작성 — `tests/events.test.ts`**

```ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  ReporterEvent,
  TestBeginEvent,
  TestEndEvent,
  StepBeginEvent,
  StepEndEvent,
  StdoutEvent,
  StderrEvent,
  ReporterEventBatch,
} from '../src/events/reporter-events.js';
import { ReporterEventType, RunItemStatus } from '../src/constants/index.js';

describe('reporter-events types', () => {
  it('TestEndEvent carries final status', () => {
    const ev: TestEndEvent = {
      type: ReporterEventType.TestEnd,
      itemId: 'item-1',
      ts: '2026-04-12T00:00:00.000Z',
      payload: { status: RunItemStatus.Passed, durationMs: 100 },
    };
    expect(ev.payload.status).toBe('passed');
  });

  it('TestBeginEvent has null payload', () => {
    const ev: TestBeginEvent = {
      type: ReporterEventType.TestBegin,
      itemId: 'item-1',
      ts: '2026-04-12T00:00:00.000Z',
      payload: {},
    };
    expect(ev.payload).toEqual({});
  });

  it('StepBeginEvent/StepEndEvent carry title/durationMs', () => {
    const begin: StepBeginEvent = {
      type: ReporterEventType.StepBegin,
      itemId: 'item-1',
      ts: 't',
      payload: { title: 'click button' },
    };
    const end: StepEndEvent = {
      type: ReporterEventType.StepEnd,
      itemId: 'item-1',
      ts: 't',
      payload: { title: 'click button', durationMs: 50 },
    };
    expect(begin.payload.title).toBe('click button');
    expect(end.payload.durationMs).toBe(50);
  });

  it('StdoutEvent/StderrEvent carry text', () => {
    const out: StdoutEvent = {
      type: ReporterEventType.Stdout,
      itemId: 'item-1',
      ts: 't',
      payload: { text: 'hello' },
    };
    const err: StderrEvent = {
      type: ReporterEventType.Stderr,
      itemId: 'item-1',
      ts: 't',
      payload: { text: 'boom' },
    };
    expect(out.payload.text).toBe('hello');
    expect(err.payload.text).toBe('boom');
  });

  it('ReporterEventBatch wraps array of ReporterEvent', () => {
    const batch: ReporterEventBatch = {
      events: [
        {
          type: ReporterEventType.TestBegin,
          itemId: 'item-1',
          ts: 't',
          payload: {},
        },
      ],
    };
    expectTypeOf(batch.events).toEqualTypeOf<ReporterEvent[]>();
    expect(batch.events.length).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @platform/shared test`
Expected: FAIL — `Cannot find module '../src/events/reporter-events.js'`.

- [ ] **Step 3: `src/events/reporter-events.ts` 작성**

```ts
import type { ReporterEventType, RunItemStatus } from '../constants/index.js';

export interface ReporterEventBase {
  itemId: string;
  ts: string;
}

export interface TestBeginEvent extends ReporterEventBase {
  type: typeof ReporterEventType.TestBegin;
  payload: Record<string, never>;
}

export interface TestEndEvent extends ReporterEventBase {
  type: typeof ReporterEventType.TestEnd;
  payload: {
    status: RunItemStatus;
    durationMs: number;
    errorMessage?: string;
  };
}

export interface StepBeginEvent extends ReporterEventBase {
  type: typeof ReporterEventType.StepBegin;
  payload: { title: string };
}

export interface StepEndEvent extends ReporterEventBase {
  type: typeof ReporterEventType.StepEnd;
  payload: { title: string; durationMs: number; errorMessage?: string };
}

export interface StdoutEvent extends ReporterEventBase {
  type: typeof ReporterEventType.Stdout;
  payload: { text: string };
}

export interface StderrEvent extends ReporterEventBase {
  type: typeof ReporterEventType.Stderr;
  payload: { text: string };
}

export type ReporterEvent =
  | TestBeginEvent
  | TestEndEvent
  | StepBeginEvent
  | StepEndEvent
  | StdoutEvent
  | StderrEvent;

export interface ReporterEventBatch {
  events: ReporterEvent[];
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @platform/shared test`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add packages/shared/src/events/reporter-events.ts packages/shared/tests/events.test.ts
git commit -m "feat(shared): define reporter event types"
```

---

### Task 14: `shared` 이벤트 — queue messages

**Files:**
- Create: `packages/shared/src/events/queue-messages.ts`
- Create: `packages/shared/src/events/index.ts`
- Modify: `packages/shared/tests/events.test.ts`

- [ ] **Step 1: 실패 테스트 append — `tests/events.test.ts` 끝에 추가**

```ts
import type {
  RunItemExecuteMessage,
  QueueMessageRoutingKey,
} from '../src/events/queue-messages.js';

describe('queue-messages', () => {
  it('RunItemExecuteMessage carries identifiers and bundle key', () => {
    const msg: RunItemExecuteMessage = {
      runId: 'run-1',
      itemId: 'item-1',
      deploymentId: 'dep-1',
      testCaseId: 'TC-001',
      testFileBundleKey: 'deployments/dep-1/files/cart.spec.js',
      adminBaseUrl: 'http://admin:3000',
    };
    expect(msg.testCaseId).toBe('TC-001');
  });

  it('routing key constant exists', () => {
    const key: QueueMessageRoutingKey = 'run.item.execute';
    expect(key).toBe('run.item.execute');
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter @platform/shared test`
Expected: FAIL.

- [ ] **Step 3: `src/events/queue-messages.ts` 작성**

```ts
export interface RunItemExecuteMessage {
  runId: string;
  itemId: string;
  deploymentId: string;
  testCaseId: string;
  testFileBundleKey: string;
  adminBaseUrl: string;
}

export type QueueMessageRoutingKey = 'run.item.execute';

export const ROUTING_KEY_RUN_ITEM_EXECUTE: QueueMessageRoutingKey = 'run.item.execute';

export const EXCHANGE_TEST_RUNS = 'test-runs';
export const QUEUE_TEST_RUN_ITEMS = 'test-run-items';
export const QUEUE_TEST_RUNS_DLQ = 'test-runs-dlq';
```

- [ ] **Step 4: `src/events/index.ts` 작성**

```ts
export * from './reporter-events.js';
export * from './queue-messages.js';
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `pnpm --filter @platform/shared test`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add packages/shared/src/events/queue-messages.ts packages/shared/src/events/index.ts packages/shared/tests/events.test.ts
git commit -m "feat(shared): define queue message schema and routing constants"
```

---

### Task 15: `shared` DTOs — test case

**Files:**
- Create: `packages/shared/src/dto/test-case.ts`

- [ ] **Step 1: `src/dto/test-case.ts` 작성 (타입만이므로 단위 테스트는 선택적)**

```ts
export interface TestCaseDto {
  id: string;
  name: string;
  description: string | null;
  params: Record<string, unknown>;
  expected: Record<string, unknown>;
  tags: string[];
  autoCreated: boolean;
  createdAt: string;
  updatedAt: string;
  /** 최신 성공 배포의 매핑에 이 TC가 존재하는지 서버에서 계산한 값 */
  isActive: boolean;
}

export interface TestCasePatchDto {
  name?: string;
  description?: string | null;
  params?: Record<string, unknown>;
  expected?: Record<string, unknown>;
  tags?: string[];
}

export interface ResolvedTestCaseDto {
  params: Record<string, unknown>;
  expected: Record<string, unknown>;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `pnpm --filter @platform/shared build`
Expected: 컴파일 성공, `dist/dto/test-case.d.ts` 생성.

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/src/dto/test-case.ts
git commit -m "feat(shared): add test case DTOs"
```

---

### Task 16: `shared` DTOs — deployment

**Files:**
- Create: `packages/shared/src/dto/deployment.ts`

- [ ] **Step 1: `src/dto/deployment.ts` 작성**

```ts
import type { DeploymentStatus } from '../constants/statuses.js';

export interface DeploymentDto {
  id: string;
  gitRef: string;
  status: DeploymentStatus;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface DeploymentCreateDto {
  gitRef: string;
}

export interface TestFileDto {
  id: string;
  deploymentId: string;
  sourcePath: string;
  bundleKey: string;
  createdAt: string;
}

export interface DeploymentStatusUpdateDto {
  status: DeploymentStatus;
  errorMessage?: string | null;
}

export interface DeploymentMappingsDto {
  files: Array<{
    sourcePath: string;
    bundleKey: string;
  }>;
  mappings: Array<{
    testCaseId: string;
    sourcePath: string;
  }>;
}
```

- [ ] **Step 2: 빌드 확인**

Run: `pnpm --filter @platform/shared build`
Expected: 성공.

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/src/dto/deployment.ts
git commit -m "feat(shared): add deployment DTOs"
```

---

### Task 17: `shared` DTOs — run

**Files:**
- Create: `packages/shared/src/dto/run.ts`
- Create: `packages/shared/src/dto/index.ts`

- [ ] **Step 1: `src/dto/run.ts` 작성**

```ts
import type { RunItemStatus, RunStatus } from '../constants/statuses.js';

export interface RunDto {
  id: string;
  deploymentId: string;
  requestedTestCaseIds: string[];
  status: RunStatus;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  playwrightReportKey: string | null;
}

export interface RunItemDto {
  id: string;
  testRunId: string;
  testCaseId: string;
  testFileId: string;
  status: RunItemStatus;
  durationMs: number | null;
  errorMessage: string | null;
  paramsSnapshot: Record<string, unknown>;
  expectedSnapshot: Record<string, unknown>;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunCreateDto {
  testCaseIds: string[];
  paramOverrides?: Record<string, Record<string, unknown>>;
}

export interface RunItemStatusUpdateDto {
  status: RunItemStatus;
  durationMs?: number;
  errorMessage?: string | null;
}

export interface RunCompleteDto {
  playwrightReportKey?: string | null;
}
```

- [ ] **Step 2: `src/dto/index.ts` 작성**

```ts
export * from './test-case.js';
export * from './deployment.js';
export * from './run.js';
```

- [ ] **Step 3: 빌드 확인**

Run: `pnpm --filter @platform/shared build`
Expected: 성공.

- [ ] **Step 4: 커밋**

```bash
git add packages/shared/src/dto/run.ts packages/shared/src/dto/index.ts
git commit -m "feat(shared): add run DTOs"
```

---

### Task 18: `shared` 최종 public export

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: `src/index.ts`를 실제 export로 교체**

```ts
export * from './constants/index.js';
export * from './events/index.js';
export * from './dto/index.js';
```

- [ ] **Step 2: 빌드 및 테스트 전체 실행**

Run: `pnpm --filter @platform/shared build && pnpm --filter @platform/shared test`
Expected: 빌드 성공 + 모든 테스트 통과.

- [ ] **Step 3: 커밋**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): export public surface from package root"
```

---

### Task 19: 루트 README — Phase 1 기동 가이드

**Files:**
- Create: `README.md`

- [ ] **Step 1: `README.md` 작성**

````markdown
# Playwright Test Platform Demo

Playwright 기반 테스트 자동화 플랫폼의 자체 구현 데모. 설계 문서는 `docs/superpowers/specs/2026-04-12-playwright-test-platform-demo-design.md` 참조.

## 요구사항

- Node.js 20 (`nvm use` 가능)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Docker + Docker Compose v2

## 초기 세팅

```bash
pnpm install
cp .env.example .env
# 필요 시 .env 값 조정 (기본값으로도 로컬 기동 가능)
```

## 인프라 기동 (MySQL / RabbitMQ / MinIO)

```bash
docker compose up -d
docker compose ps   # 세 서비스가 모두 healthy 인지 확인
```

정지:

```bash
docker compose down            # 볼륨 유지
docker compose down -v         # 볼륨까지 삭제
```

## 패키지

- `packages/shared` — 공용 타입, 이벤트 스키마, DTO, 상수 (런타임 의존성 없음)

이후 Phase에서 추가될 패키지: `playwright-lib`, `admin-server`, `deploy-server`, `test-runner`.

## 개발 스크립트

```bash
pnpm build       # 전체 workspace 빌드
pnpm test        # 전체 workspace 테스트
pnpm lint        # ESLint
pnpm format      # Prettier
```
````

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: add README with phase 1 bring-up instructions"
```

---

### Task 20: Phase 1 전체 검증

**Files:**
- (검증 전용, 파일 수정 없음)

- [ ] **Step 1: clean install 재확인**

Run: `rm -rf node_modules packages/*/node_modules packages/*/dist && pnpm install`
Expected: 에러 없이 설치 완료.

- [ ] **Step 2: 전체 빌드**

Run: `pnpm build`
Expected: `packages/shared/dist/`에 `index.js`, `index.d.ts` 등 생성.

- [ ] **Step 3: 전체 테스트**

Run: `pnpm test`
Expected: shared 패키지의 모든 테스트 통과.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 5: Format 검사**

Run: `pnpm exec prettier --check .`
Expected: 모든 파일 포맷 일치.

- [ ] **Step 6: 인프라 기동 end-to-end**

Run:
```
docker compose up -d
sleep 20
docker compose ps
docker compose logs --tail=5 mysql rabbitmq minio
docker compose down
```
Expected:
- `docker compose ps`에서 세 서비스 모두 `healthy`
- `logs`에서 치명적 에러 없음
- `down`이 정상 완료

- [ ] **Step 7: 상태 확인 커밋 (있을 경우)**

Run: `git status`
Expected: working tree clean.

---

## 완료 조건

Phase 1 완료 시 다음이 모두 만족되어야 함:
- `pnpm install` / `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm format` 모두 성공
- `packages/shared`가 빌드되어 다른 패키지가 `@platform/shared`로 import 가능한 상태
- `docker compose up -d`로 MySQL·RabbitMQ·MinIO가 healthy 상태까지 기동
- `README.md`에 기동 절차가 문서화
- git 히스토리가 task 단위로 작은 commit으로 나뉘어 있음

다음 Phase: `Phase 2 — playwright-lib` (커스텀 리포터 + `testCase()` + admin HTTP 클라이언트).
