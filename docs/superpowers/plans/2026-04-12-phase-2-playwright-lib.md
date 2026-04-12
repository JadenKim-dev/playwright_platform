# Phase 2: `@platform/playwright-lib` — testCase() + Streaming Reporter + Admin Client

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외부 테스트 repo가 import해서 사용하는 `@platform/playwright-lib` 패키지를 TDD로 구현한다. 세 가지 공개 API를 제공한다:

1. `testCase(id, callback)` — Playwright `test()` + `test.step()` 래퍼, 실행 시점에 admin의 `/resolve`로 `{params, expected}`를 조회해 콜백에 주입.
2. `StreamingReporter` — Playwright `Reporter` 인터페이스 구현. `onTestBegin`/`onStepBegin`/`onStepEnd`/`onTestEnd`/`onEnd`에서 이벤트를 버퍼링하고 `chunkSize`/`flushIntervalMs` 기준으로 admin의 `/internal/runs/:id/events`로 POST. `onEnd`에서 최종 flush + `/complete` 호출.
3. `AdminClient` — fetch 래퍼 + 재시도 + 타임아웃 + `X-Internal-Token` 자동 부착. POST 실패 시 로컬 버퍼 유지 → N회 재시도 후 `process.exit(1)`.

**Architecture:** `@platform/shared`에서 정의한 타입(`ReporterEvent`, `ResolvedTestCaseDto`, `ReporterEventBatch`)을 재사용. 런타임 의존성: `@playwright/test`(peerDependency), `@platform/shared`. 환경변수(`PLATFORM_RUN_ID`, `PLATFORM_ITEM_ID`, `PLATFORM_ADMIN_URL`, `PLATFORM_INTERNAL_API_TOKEN`, `PLATFORM_REPORTER_CHUNK_SIZE`, `PLATFORM_REPORTER_FLUSH_INTERVAL_MS`)로 러너에서 주입. 테스트는 Node 내장 fetch를 mock(globalThis.fetch)하고 Playwright Reporter 이벤트는 수동으로 호출해 버퍼/플러시 경로를 검증.

**Tech Stack:** TypeScript 5.x (NodeNext), Vitest, `@playwright/test` (peerDep — 설치는 하되 dev로), `@platform/shared`(workspace:*).

---

## 파일 구조

Phase 2에서 생성/수정하는 파일:

- Create: `packages/playwright-lib/package.json`
- Create: `packages/playwright-lib/tsconfig.json`
- Create: `packages/playwright-lib/vitest.config.ts`
- Create: `packages/playwright-lib/src/index.ts`
- Create: `packages/playwright-lib/src/env.ts` — `PLATFORM_*` env 파서
- Create: `packages/playwright-lib/src/client.ts` — `AdminClient`
- Create: `packages/playwright-lib/src/test-case.ts` — `testCase(id, fn)`
- Create: `packages/playwright-lib/src/reporter.ts` — `StreamingReporter`
- Create: `packages/playwright-lib/src/reporter-entry.ts` — Playwright `reporter: [['@platform/playwright-lib/reporter']]` 로드용 default export
- Create: `packages/playwright-lib/tests/env.test.ts`
- Create: `packages/playwright-lib/tests/client.test.ts`
- Create: `packages/playwright-lib/tests/test-case.test.ts`
- Create: `packages/playwright-lib/tests/reporter.test.ts`
- Modify: root `README.md` — Phase 2 빌드/테스트 확인 명령 추가 (작은 섹션)

**공개 export (`src/index.ts`)**: `testCase`, `StreamingReporter`, `AdminClient`, `loadPlatformEnv`, 그리고 관련 타입(`AdminClientOptions`, `StreamingReporterOptions`).

**reporter 서브패스 export (`package.json#exports`)**: `'./reporter'` 경로로 `reporter-entry.ts`를 노출 → 외부 `playwright.config.ts`에서 `'@platform/playwright-lib/reporter'`로 require 가능.

---

### Task 1: `packages/playwright-lib` 패키지 골격

**Files:**

- Create: `packages/playwright-lib/package.json`
- Create: `packages/playwright-lib/tsconfig.json`
- Create: `packages/playwright-lib/vitest.config.ts`
- Create: `packages/playwright-lib/src/index.ts` (빈 placeholder)

- [ ] **Step 1: `packages/playwright-lib/package.json` 작성**

```json
{
  "name": "@platform/playwright-lib",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./reporter": {
      "types": "./dist/reporter-entry.d.ts",
      "default": "./dist/reporter-entry.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@platform/shared": "workspace:*"
  },
  "peerDependencies": {
    "@playwright/test": "^1.47.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0"
  }
}
```

- [ ] **Step 2: `packages/playwright-lib/tsconfig.json` 작성**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": false,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "tests"]
}
```

- [ ] **Step 3: `packages/playwright-lib/vitest.config.ts` 작성**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    passWithNoTests: false,
  },
});
```

- [ ] **Step 4: `packages/playwright-lib/src/index.ts` 빈 placeholder**

```ts
export {};
```

- [ ] **Step 5: 의존성 설치 및 빌드 확인**

```bash
pnpm install
pnpm --filter @platform/playwright-lib build
pnpm --filter @platform/shared build
```
Expected: 두 패키지 모두 에러 없이 빌드.

- [ ] **Step 6: 커밋**

```bash
git add packages/playwright-lib pnpm-lock.yaml
git commit -m "feat(playwright-lib): scaffold package"
```

---

### Task 2: `env.ts` — `PLATFORM_*` 환경변수 파싱 (TDD)

**Files:**

- Create: `packages/playwright-lib/tests/env.test.ts`
- Create: `packages/playwright-lib/src/env.ts`

**Purpose:** 러너가 주입하는 env를 한 곳에서 로드/검증. 필수값 누락 시 명확한 에러, 선택값은 기본값으로 채움.

- [ ] **Step 1: RED — 테스트 먼저 작성 (`tests/env.test.ts`)**

검증 항목:
1. 모든 필수 env(`PLATFORM_RUN_ID`, `PLATFORM_ITEM_ID`, `PLATFORM_ADMIN_URL`, `PLATFORM_INTERNAL_API_TOKEN`)가 있으면 객체 반환.
2. 필수 env 누락 시 메시지에 env 이름을 포함한 `Error` throw.
3. `PLATFORM_REPORTER_CHUNK_SIZE` 미설정 시 기본값 `50`.
4. `PLATFORM_REPORTER_FLUSH_INTERVAL_MS` 미설정 시 기본값 `2000`.
5. 숫자 env가 NaN이면 에러.

`process.env`를 직접 mutate하지 말고 `loadPlatformEnv(source: NodeJS.ProcessEnv)`처럼 인자로 받게 해서 순수 함수화.

- [ ] **Step 2: RED 검증**

```bash
pnpm --filter @platform/playwright-lib test
```
Expected: "Failed to resolve import ... env.js" 또는 "loadPlatformEnv is not a function" 등으로 실패.

- [ ] **Step 3: GREEN — `src/env.ts` 구현**

```ts
export interface PlatformEnv {
  runId: string;
  itemId: string;
  adminUrl: string;
  internalApiToken: string;
  reporterChunkSize: number;
  reporterFlushIntervalMs: number;
}

const DEFAULT_CHUNK_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 2000;

function required(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

function parseInt(value: string | undefined, fallback: number, key: string): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric env ${key}: ${value}`);
  return n;
}

export function loadPlatformEnv(source: NodeJS.ProcessEnv = process.env): PlatformEnv {
  return {
    runId: required(source, 'PLATFORM_RUN_ID'),
    itemId: required(source, 'PLATFORM_ITEM_ID'),
    adminUrl: required(source, 'PLATFORM_ADMIN_URL'),
    internalApiToken: required(source, 'PLATFORM_INTERNAL_API_TOKEN'),
    reporterChunkSize: parseInt(source.PLATFORM_REPORTER_CHUNK_SIZE, DEFAULT_CHUNK_SIZE, 'PLATFORM_REPORTER_CHUNK_SIZE'),
    reporterFlushIntervalMs: parseInt(
      source.PLATFORM_REPORTER_FLUSH_INTERVAL_MS,
      DEFAULT_FLUSH_INTERVAL_MS,
      'PLATFORM_REPORTER_FLUSH_INTERVAL_MS',
    ),
  };
}
```

- [ ] **Step 4: GREEN 검증**

```bash
pnpm --filter @platform/playwright-lib test
```
Expected: env 관련 테스트 모두 통과.

- [ ] **Step 5: 커밋**

```bash
git add packages/playwright-lib/src/env.ts packages/playwright-lib/tests/env.test.ts
git commit -m "feat(playwright-lib): parse PLATFORM_* env with defaults and validation"
```

---

### Task 3: `client.ts` — `AdminClient` (TDD)

**Files:**

- Create: `packages/playwright-lib/tests/client.test.ts`
- Create: `packages/playwright-lib/src/client.ts`

**Purpose:** admin-server의 `/internal/*` 엔드포인트를 호출하는 fetch 래퍼. 세 메서드:

- `resolve(tcId): Promise<ResolvedTestCaseDto>` → `GET /internal/runs/:runId/test-case/:tcId/resolve`
- `postEvents(batch: ReporterEventBatch): Promise<void>` → `POST /internal/runs/:runId/events`
- `complete(body: RunCompleteDto): Promise<void>` → `POST /internal/runs/:runId/complete`

공통 규칙:

- 모든 요청에 `X-Internal-Token` 헤더 자동 부착
- `Content-Type: application/json`
- 타임아웃 (기본 10s): `AbortController`로 중단
- 재시도 (기본 3회, 지수 백오프 100ms → 200ms → 400ms): 5xx / 네트워크 에러에서만. 4xx는 즉시 throw.
- 재시도 모두 실패 → throw (reporter가 이를 받아 `process.exit(1)` 결정)

**주의**: `fetch`는 `options.fetch`로 주입 가능하게 해서 테스트에서 mock. 전역 `globalThis.fetch`는 기본값.

- [ ] **Step 1: RED — `tests/client.test.ts` 작성**

검증 항목 (모든 케이스에서 fetch mock 주입):

1. `resolve`가 올바른 URL과 헤더를 호출하고 JSON을 파싱해 반환.
2. `postEvents`가 body에 `JSON.stringify(batch)`를 담아 POST.
3. `complete`가 POST로 호출.
4. 5xx 응답 → 3회까지 재시도 후 throw. mock이 3번째에 200을 반환하면 성공.
5. 4xx 응답은 재시도 없이 즉시 throw.
6. 네트워크 에러(`fetch` reject) → 재시도.
7. `X-Internal-Token` 헤더가 주입된 토큰값으로 전송.
8. 타임아웃: mock이 `AbortError`를 던지는 시나리오 재현 → 재시도 소진 시 throw.

재시도 백오프 테스트는 `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync`로 시간 제어.

- [ ] **Step 2: RED 검증**

```bash
pnpm --filter @platform/playwright-lib test
```
Expected: client 테스트 모두 실패.

- [ ] **Step 3: GREEN — `src/client.ts` 구현**

```ts
import type { ReporterEventBatch, ResolvedTestCaseDto, RunCompleteDto } from '@platform/shared';

export interface AdminClientOptions {
  adminUrl: string;
  runId: string;
  internalApiToken: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  fetchFn?: typeof fetch;
}

export class AdminClient {
  private readonly adminUrl: string;
  private readonly runId: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(opts: AdminClientOptions) {
    this.adminUrl = opts.adminUrl.replace(/\/$/, '');
    this.runId = opts.runId;
    this.token = opts.internalApiToken;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.maxRetries = opts.maxRetries ?? 3;
    this.baseBackoffMs = opts.baseBackoffMs ?? 100;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async resolve(tcId: string): Promise<ResolvedTestCaseDto> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/test-case/${encodeURIComponent(tcId)}/resolve`;
    return this.requestJson<ResolvedTestCaseDto>('GET', url);
  }

  async postEvents(batch: ReporterEventBatch): Promise<void> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/events`;
    await this.requestJson<void>('POST', url, batch);
  }

  async complete(body: RunCompleteDto): Promise<void> {
    const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/complete`;
    await this.requestJson<void>('POST', url, body);
  }

  private async requestJson<T>(method: string, url: string, body?: unknown): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const res = await this.fetchFn(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Token': this.token,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          });
          if (res.status >= 500) throw new Error(`admin ${method} ${url} → ${res.status}`);
          if (!res.ok) throw new NonRetriableError(`admin ${method} ${url} → ${res.status}`);
          if (res.status === 204) return undefined as T;
          const ct = res.headers.get('content-type') ?? '';
          if (ct.includes('application/json')) return (await res.json()) as T;
          return undefined as T;
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        lastErr = err;
        if (err instanceof NonRetriableError) throw err;
        if (attempt === this.maxRetries) break;
        const delay = this.baseBackoffMs * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

class NonRetriableError extends Error {}
```

> `RunCompleteDto`가 shared에 없으면 복붙하지 말고 shared에서 추가/확인할 것. Phase 1에서 `RunCompleteDto`를 정의했음.

- [ ] **Step 4: GREEN 검증**

```bash
pnpm --filter @platform/playwright-lib test
pnpm --filter @platform/playwright-lib build
```
Expected: 테스트 전부 통과, 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add packages/playwright-lib/src/client.ts packages/playwright-lib/tests/client.test.ts
git commit -m "feat(playwright-lib): AdminClient with retry, timeout, and internal token auth"
```

---

### Task 4: `test-case.ts` — `testCase(id, fn)` (TDD)

**Files:**

- Create: `packages/playwright-lib/tests/test-case.test.ts`
- Create: `packages/playwright-lib/src/test-case.ts`

**Purpose:** 외부 테스트 repo가 `import { testCase } from '@platform/playwright-lib'` 후 `testCase('TC-001', async ({ page, params, expected }) => { ... })`로 쓰는 래퍼.

**설계 요점:**

- 내부적으로 `@playwright/test`의 `test(name, fn)`를 호출 (`name = id`).
- 실행 시점에 `AdminClient.resolve(id)`로 `{params, expected}` 조회 후 콜백 fixture에 주입.
- `resolve` 호출 자체는 `test.step('resolve test case')`로 감싸 Playwright 리포트에 보이게.
- `run_id`/`item_id`/`admin_url`/`token`은 `loadPlatformEnv()`로 획득.
- **의존성 주입**: `@platform/shared`, `@playwright/test`, env 로더, 클라이언트 팩토리를 기본값으로 두되 테스트에서 갈아끼울 수 있는 구조. 즉, 내부 함수 `createTestCase(deps)`를 export하고 `testCase`는 기본 deps 바인딩 버전.

**주의**: 실제 Playwright 런타임 없이 테스트하려면 `test()`를 mock. `test.step()`도 함께 mock.

- [ ] **Step 1: RED — `tests/test-case.test.ts` 작성**

검증 항목:

1. `testCase('TC-001', fn)` 호출 시 mock `test('TC-001', ...)`가 호출됨.
2. Playwright가 전달하는 fixtures(`{ page }`)에 `params`, `expected`가 추가된 객체로 사용자 콜백이 호출됨.
3. `AdminClient.resolve('TC-001')`가 실행 단계에서 호출됨.
4. `resolve`가 `test.step('resolve test case ...')` 내부에서 호출됨.
5. `resolve` 실패 시 에러가 전파됨 (사용자 콜백은 호출되지 않음).

구현 힌트: deps로 `{ test, adminClient, env }`를 받는 factory를 테스트에서 직접 호출.

- [ ] **Step 2: RED 검증**

```bash
pnpm --filter @platform/playwright-lib test
```
Expected: test-case 관련 테스트 실패.

- [ ] **Step 3: GREEN — `src/test-case.ts` 구현**

```ts
import { test as defaultTest } from '@playwright/test';
import type { ResolvedTestCaseDto } from '@platform/shared';
import { AdminClient } from './client.js';
import { loadPlatformEnv, type PlatformEnv } from './env.js';

export interface PlatformFixtures {
  params: Record<string, unknown>;
  expected: Record<string, unknown>;
}

// Playwright의 fixture 타입을 전체로 쓰기엔 복잡하므로, 사용자 콜백은
// 최소한 page만 있다고 가정한 형태로 좁게 선언. any/unknown은 피하고 제네릭으로 받음.
export type TestCaseCallback<Fixtures> = (args: Fixtures & PlatformFixtures) => Promise<void> | void;

export interface TestCaseDeps {
  test: typeof defaultTest;
  createClient: (env: PlatformEnv) => AdminClient;
  loadEnv: () => PlatformEnv;
}

export function createTestCase(deps: TestCaseDeps) {
  return function testCase<Fixtures>(id: string, fn: TestCaseCallback<Fixtures>): void {
    deps.test(id, async (fixtures: Fixtures, testInfo) => {
      const env = deps.loadEnv();
      const client = deps.createClient(env);
      let resolved: ResolvedTestCaseDto | undefined;
      await deps.test.step(`resolve test case ${id}`, async () => {
        resolved = await client.resolve(id);
      });
      await fn({ ...fixtures, params: resolved!.params, expected: resolved!.expected });
    });
  };
}

export const testCase = createTestCase({
  test: defaultTest,
  createClient: (env) =>
    new AdminClient({
      adminUrl: env.adminUrl,
      runId: env.runId,
      internalApiToken: env.internalApiToken,
    }),
  loadEnv: () => loadPlatformEnv(),
});
```

- [ ] **Step 4: GREEN 검증**

```bash
pnpm --filter @platform/playwright-lib test
pnpm --filter @platform/playwright-lib build
```
Expected: test-case 테스트 통과, 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add packages/playwright-lib/src/test-case.ts packages/playwright-lib/tests/test-case.test.ts
git commit -m "feat(playwright-lib): testCase() wrapper resolves params/expected at runtime"
```

---

### Task 5: `reporter.ts` — `StreamingReporter` + `AdminClient.updateItemStatus` (TDD)

**Files:**

- Modify: `packages/playwright-lib/src/client.ts` — `updateItemStatus` 메서드 추가
- Modify: `packages/playwright-lib/tests/client.test.ts` — `updateItemStatus` 테스트 추가
- Create: `packages/playwright-lib/tests/reporter.test.ts`
- Create: `packages/playwright-lib/src/reporter.ts`
- Create: `packages/playwright-lib/src/reporter-entry.ts`

**Purpose:** Playwright `Reporter` 인터페이스 구현. 메모리에 전체 결과를 쌓지 않고, 일정 조건에서 admin으로 flush.

**설계 정정 (원 Task 3 코드 보완):**

- `AdminClient.complete()`는 run 레벨 완료 신호용이라 reporter(item 단위 실행)가 호출할 곳이 아니다. reporter는 **item 상태**를 업데이트해야 한다. 그래서 이 태스크에서 `AdminClient.updateItemStatus(body: RunItemStatusUpdateDto)` 메서드를 추가한다.
- URL: `POST /internal/runs/:runId/items/:itemId/status` (itemId는 env에 있으므로 생성자에서 받아둠).
- Body 타입: `RunItemStatusUpdateDto { status, durationMs?, errorMessage? }` — 이미 `@platform/shared`에 정의됨.
- `AdminClient` 생성자 옵션에 `itemId: string` 추가. `complete()`는 그대로 유지 (러너 오케스트레이터가 쓸 예정).

**버퍼/플러시 규칙:**

- 내부 버퍼에 `ReporterEvent[]` 누적.
- 버퍼 길이가 `chunkSize` 이상이면 즉시 flush(비동기이지만 `await` 하지 않고 background, 그러나 보류 중 flush는 한 번에 하나로 직렬화 — 동시 다발 POST 방지).
- `flushIntervalMs`마다 주기적 flush(setInterval).
- `onEnd()`에서 최종 flush 후 `client.updateItemStatus({ status, durationMs, errorMessage })` 호출 + interval 정리.
- flush 중 실패가 재시도 소진으로 끝나면 기본 동작: 에러 로그 후 `process.exit(1)`. 테스트에서 갈아끼울 수 있도록 `onFatal` 콜백 옵션.

**이벤트 매핑(Playwright → `ReporterEvent`):**

- `onTestBegin(test, result)` → `TestBeginEvent { itemId, ts }`
- `onStepBegin(test, result, step)` → `StepBeginEvent { itemId, ts, payload: { title: step.title } }` — `test.step` 레벨만(카테고리 `test.step`), hook/attach 등은 제외
- `onStepEnd(test, result, step)` → `StepEndEvent { itemId, ts, payload: { title, durationMs, errorMessage? } }`
- `onTestEnd(test, result)` → `TestEndEvent { itemId, ts, payload: { status, durationMs, errorMessage? } }`, `result.status`를 `RunItemStatus`로 매핑(`passed` → `passed`, `failed`/`timedOut` → `failed`, `skipped` → `skipped`). 알 수 없으면 `failed`.
- `onStdOut(chunk, test)` → `StdoutEvent { payload: { text } }` — Playwright stdout 훅 사용.
- `onStdErr(chunk, test)` → `StderrEvent`

`itemId`는 env의 `PLATFORM_ITEM_ID`를 고정 사용 (러너가 item별 프로세스를 띄우므로).

**생성자 옵션**: Playwright가 `new Reporter(options)`로 호출 → options에 `chunkSize`, `flushIntervalMs`가 있으면 우선, 없으면 env의 값 사용.

- [ ] **Step 0: RED — `AdminClient.updateItemStatus` 테스트 추가 (`tests/client.test.ts`)**

`AdminClient` 생성자 옵션에 `itemId`를 추가하고, 다음 2개 테스트 추가:

1. `updateItemStatus({ status: 'passed', durationMs: 42 })` → `POST {adminUrl}/internal/runs/{runId}/items/{itemId}/status`로 body를 JSON으로 전송, `X-Internal-Token` 헤더 포함.
2. 옵션의 `itemId`가 URL에 URL-encode되어 들어감 (예: `item with space`가 안전하게 인코딩).

기존 생성자 호출부도 `itemId` 인자를 받도록 업데이트. `itemId`가 필요 없는 메서드(`resolve`/`postEvents`/`complete`) 테스트는 그대로 통과해야 함.

- [ ] **Step 0-verify: RED 실행**

```bash
pnpm --filter @platform/playwright-lib test
```
Expected: 2개 새 테스트 실패 (`updateItemStatus is not a function` 등).

- [ ] **Step 0-GREEN: `src/client.ts`에 `updateItemStatus` 구현**

```ts
// 생성자 옵션 확장
export interface AdminClientOptions {
  adminUrl: string;
  runId: string;
  itemId: string;           // ← 추가
  internalApiToken: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  fetchFn?: typeof fetch;
}

// 필드 추가
private readonly itemId: string;
// constructor에서:
this.itemId = opts.itemId;

// 새 메서드
async updateItemStatus(body: RunItemStatusUpdateDto): Promise<void> {
  const url = `${this.adminUrl}/internal/runs/${encodeURIComponent(this.runId)}/items/${encodeURIComponent(this.itemId)}/status`;
  await this.requestJson<void>('POST', url, body);
}
```

`RunItemStatusUpdateDto`를 `@platform/shared`에서 import. 기존 `test-case.ts`의 `createClient`도 `itemId: env.itemId`를 전달하도록 업데이트.

- [ ] **Step 0-verify-green: 테스트 재실행**

```bash
pnpm --filter @platform/playwright-lib test
pnpm --filter @platform/playwright-lib build
```
Expected: 전체 통과 (env 5 + client 10 + test-case 5 = 20).

- [ ] **Step 0-commit**

```bash
git add packages/playwright-lib/src/client.ts packages/playwright-lib/src/test-case.ts packages/playwright-lib/tests/client.test.ts
git commit -m "feat(playwright-lib): add AdminClient.updateItemStatus and itemId option"
```

---

- [ ] **Step 1: RED — `tests/reporter.test.ts` 작성**

테스트 시 실제 Playwright 타입 인스턴스를 만들기 까다로우므로 **최소한의 덕 타이핑**으로 가짜 `TestCase`/`TestResult`/`TestStep` 객체를 구성해 이벤트 메서드 호출.

검증 항목:

1. `onTestBegin` 호출 시 버퍼에 `TestBegin` 이벤트가 쌓인다.
2. `chunkSize=2`로 설정한 뒤 2번 push → `AdminClient.postEvents`가 한 번 호출되고 events 길이 = 2.
3. `flushIntervalMs=100`으로 타이머 흐르면 주기 flush가 호출됨(fake timer).
4. `onEnd()` 호출 시 남은 버퍼 flush + `client.updateItemStatus({ status, durationMs, errorMessage })`가 호출되고 interval이 정리됨. status/durationMs/errorMessage는 직전 `onTestEnd`에서 포착한 값.
5. `onStepBegin`에서 카테고리가 `test.step`이 아닌 step은 이벤트로 쌓이지 않는다(hook, fixture 등 제외).
6. `result.status='failed'` + `error.message` 있으면 `TestEndEvent.payload.errorMessage`에 포함되고 `updateItemStatus` body에도 전달.
7. flush 실패 재시도 소진 → 주입한 `onFatal` 콜백 호출 (기본값은 `process.exit`).
8. 동시 push 중 flush 진행 중이면 직렬화되어 POST가 겹쳐 호출되지 않는다.

- [ ] **Step 2: RED 검증**

```bash
pnpm --filter @platform/playwright-lib test
```
Expected: reporter 테스트 실패.

- [ ] **Step 3: GREEN — `src/reporter.ts` 구현**

주요 설계:

```ts
import type { Reporter, TestCase, TestResult, TestStep, FullResult } from '@playwright/test/reporter';
import {
  ReporterEventType,
  RunItemStatus,
  type ReporterEvent,
  type ReporterEventBatch,
} from '@platform/shared';
import { AdminClient } from './client.js';
import { loadPlatformEnv, type PlatformEnv } from './env.js';

export interface StreamingReporterOptions {
  chunkSize?: number;
  flushIntervalMs?: number;
  client?: AdminClient;
  env?: PlatformEnv;
  onFatal?: (err: unknown) => void;
  now?: () => Date;
}

export class StreamingReporter implements Reporter {
  private readonly env: PlatformEnv;
  private readonly client: AdminClient;
  private readonly chunkSize: number;
  private readonly flushIntervalMs: number;
  private readonly onFatal: (err: unknown) => void;
  private readonly now: () => Date;

  private buffer: ReporterEvent[] = [];
  private flushing: Promise<void> | null = null;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private finalStatus: RunItemStatus = RunItemStatus.Passed;
  private finalDurationMs: number | undefined;
  private finalErrorMessage: string | undefined;

  constructor(options: StreamingReporterOptions = {}) {
    this.env = options.env ?? loadPlatformEnv();
    this.client =
      options.client ??
      new AdminClient({
        adminUrl: this.env.adminUrl,
        runId: this.env.runId,
        itemId: this.env.itemId,
        internalApiToken: this.env.internalApiToken,
      });
    this.chunkSize = options.chunkSize ?? this.env.reporterChunkSize;
    this.flushIntervalMs = options.flushIntervalMs ?? this.env.reporterFlushIntervalMs;
    this.onFatal = options.onFatal ?? ((err) => {
       
      console.error('[StreamingReporter] fatal:', err);
      process.exit(1);
    });
    this.now = options.now ?? (() => new Date());
  }

  onBegin(): void {
    this.intervalHandle = setInterval(() => void this.flushSafe(), this.flushIntervalMs);
  }

  onTestBegin(_test: TestCase, _result: TestResult): void {
    this.push({
      type: ReporterEventType.TestBegin,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: {},
    });
  }

  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    this.push({
      type: ReporterEventType.StepBegin,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { title: step.title },
    });
  }

  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'test.step') return;
    this.push({
      type: ReporterEventType.StepEnd,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: {
        title: step.title,
        durationMs: step.duration,
        errorMessage: step.error?.message,
      },
    });
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    const status = mapStatus(result.status);
    this.finalStatus = status;
    this.finalDurationMs = result.duration;
    this.finalErrorMessage = result.error?.message;
    this.push({
      type: ReporterEventType.TestEnd,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: {
        status,
        durationMs: result.duration,
        errorMessage: result.error?.message,
      },
    });
  }

  onStdOut(chunk: string | Buffer): void {
    this.push({
      type: ReporterEventType.Stdout,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { text: chunk.toString() },
    });
  }

  onStdErr(chunk: string | Buffer): void {
    this.push({
      type: ReporterEventType.Stderr,
      itemId: this.env.itemId,
      ts: this.now().toISOString(),
      payload: { text: chunk.toString() },
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    await this.flushSafe();
    try {
      await this.client.updateItemStatus({
        status: this.finalStatus,
        durationMs: this.finalDurationMs,
        errorMessage: this.finalErrorMessage,
      });
    } catch (err) {
      this.onFatal(err);
    }
  }

  private push(ev: ReporterEvent): void {
    this.buffer.push(ev);
    if (this.buffer.length >= this.chunkSize) void this.flushSafe();
  }

  private async flushSafe(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.buffer.length === 0) return;
    const events = this.buffer.splice(0, this.buffer.length);
    const batch: ReporterEventBatch = { events };
    this.flushing = this.client
      .postEvents(batch)
      .catch((err) => this.onFatal(err))
      .finally(() => {
        this.flushing = null;
      });
    return this.flushing;
  }
}

function mapStatus(s: TestResult['status']): RunItemStatus {
  switch (s) {
    case 'passed':
      return RunItemStatus.Passed;
    case 'skipped':
      return RunItemStatus.Skipped;
    case 'failed':
    case 'timedOut':
    case 'interrupted':
    default:
      return RunItemStatus.Failed;
  }
}
```

> **주의**: `RunCompleteDto` 필드명(`itemId`, `status`)이 Phase 1에서 정의한 형태와 일치하는지 타입 체커로 검증 필요. 불일치 시 shared를 수정하는 게 아니라 reporter가 shared에 맞게 호출해야 함.

`src/reporter-entry.ts`:

```ts
import { StreamingReporter } from './reporter.js';
export default StreamingReporter;
```

- [ ] **Step 4: GREEN 검증**

```bash
pnpm --filter @platform/playwright-lib test
pnpm --filter @platform/playwright-lib build
```
Expected: 전체 reporter 테스트 통과, 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
git add packages/playwright-lib/src/reporter.ts packages/playwright-lib/src/reporter-entry.ts packages/playwright-lib/tests/reporter.test.ts
git commit -m "feat(playwright-lib): StreamingReporter with chunked buffer and interval flush"
```

---

### Task 6: 공개 export 정리 + 루트 verification

**Files:**

- Modify: `packages/playwright-lib/src/index.ts`
- Modify: `README.md` (Phase 2 섹션 추가)

- [ ] **Step 1: `src/index.ts` 작성**

```ts
export { loadPlatformEnv, type PlatformEnv } from './env.js';
export { AdminClient, type AdminClientOptions } from './client.js';
export { testCase, createTestCase, type TestCaseCallback, type PlatformFixtures } from './test-case.js';
export { StreamingReporter, type StreamingReporterOptions } from './reporter.js';
```

- [ ] **Step 2: README Phase 2 섹션 추가**

`README.md`에 "Phase 2 — playwright-lib" 한 섹션 추가:

```
## Phase 2 — @platform/playwright-lib

External test repos import this package to use `testCase()` and the streaming reporter.

### Verify
```bash
pnpm --filter @platform/playwright-lib test
pnpm --filter @platform/playwright-lib build
```
```

- [ ] **Step 3: 최종 verification (루트에서)**

```bash
pnpm install
pnpm -r build
pnpm -r test
pnpm lint
pnpm format:check
```
Expected: 모두 통과.

- [ ] **Step 4: 커밋**

```bash
git add packages/playwright-lib/src/index.ts README.md
git commit -m "feat(playwright-lib): expose public API and document phase 2 verification"
```

---

## Phase 완료 조건

- [ ] `packages/playwright-lib`에 6개 소스 파일(`env.ts`, `client.ts`, `test-case.ts`, `reporter.ts`, `reporter-entry.ts`, `index.ts`)과 4개 테스트 파일이 있고 모든 테스트 통과.
- [ ] `pnpm --filter @platform/playwright-lib build` 성공, `dist/index.d.ts`와 `dist/reporter-entry.d.ts`가 생성됨.
- [ ] `package.json#exports`가 루트 (`.`)와 `./reporter` 둘 다 노출.
- [ ] `pnpm -r build`, `pnpm -r test`, `pnpm lint`, `pnpm format:check` 모두 통과.
- [ ] shared 패키지의 DTO(`ResolvedTestCaseDto`, `ReporterEventBatch`, `RunCompleteDto`, `RunItemStatus`, `ReporterEventType`)만 참조, 런타임 의존성은 `@platform/shared`와 `@playwright/test`(peer)뿐.

---

## Phase 간 인터페이스 계약

**다음 Phase(3 — admin-server DB/서비스)가 맞춰야 할 계약:**

- `GET /internal/runs/:runId/test-case/:tcId/resolve` → `ResolvedTestCaseDto` 반환, `X-Internal-Token` 필수.
- `POST /internal/runs/:runId/events` → `ReporterEventBatch` 수신, 204 반환.
- `POST /internal/runs/:runId/items/:itemId/status` → `RunItemStatusUpdateDto` 수신, 204 반환. (reporter가 `onEnd`에서 호출)
- `POST /internal/runs/:runId/complete` → `RunCompleteDto` 수신, 204 반환. (러너 오케스트레이터/admin 내부에서 호출)
- 모든 `/internal/*` 경로는 Host 헤더 가드 + `X-Internal-Token` 검증 통과해야 200/204.

Phase 3/4에서 이 계약과 다르게 구현하려면 본 플랜과 reporter/client를 함께 수정할 것.
