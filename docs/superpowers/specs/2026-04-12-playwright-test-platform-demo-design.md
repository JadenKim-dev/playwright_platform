# Playwright 테스트 자동화 플랫폼 데모 — 설계 문서

- 작성일: 2026-04-12
- 참고 자료: `reference/script.txt` (토스페이먼츠 테스트 자동화 플랫폼 소개 스크립트)

## 1. 목표와 범위

이 데모는 스크립트에서 소개한 테스트 자동화 플랫폼의 구조(어드민 서버 + 테스트 러너 + 배포 서버 + 메시지 큐 + 오브젝트 스토리지)를 로컬 Docker 환경에서 자체적으로 재현하는 것이 목적이다. 학습용이 아니라 실제로 사용할 수 있는 수준까지 만들되, 인증·SaaS 운영 같은 부수 요소는 생략한다.

### 1.1 무엇을 만드는가

- Playwright 테스트 코드를 Git 원격에서 가져와 번들링/업로드하는 **배포 서버**
- RabbitMQ 메시지를 받아 Playwright를 실행하는 **테스트 러너** (수평 확장 가능)
- 테스트 케이스·배포·실행 이력을 관리하고 UI를 제공하는 **어드민 서버**
- 테스트 코드 저장소가 import해서 쓰는 **커스텀 라이브러리** (`testCase()` 함수 + 스트리밍 리포터)

### 1.2 범위 밖

- 인증·사용자 관리·RBAC
- 실제 클라우드 배포·CI/CD
- MinIO orphan 객체 GC, 대규모 운영 기능
- 메트릭 대시보드, 코드 커버리지 연동 (데이터는 쌓이므로 후속 작업 가능)

### 1.3 테스트 대상(SUT)

- 데모 리포지토리에는 SUT를 **포함하지 않는다**
- 사용자가 host 머신에서 직접 띄운 웹앱(`localhost:xxxx`)을 대상으로 함
- 러너 컨테이너는 `host.docker.internal`을 통해 host 포트로 접근
- 테스트 코드는 `process.env.SUT_BASE_URL`을 기준으로 이동

## 2. 시스템 아키텍처

### 2.1 컴포넌트 구성도

```
                          ┌──────────────────────────┐
                          │  사용자 (브라우저)        │
                          └────────────┬─────────────┘
                                       │
                                       ▼
┌───────────────────────────────────────────────────────────┐
│  Admin Server  (Next.js: UI + REST API)                   │
│   - 테스트 케이스 조회/편집                              │
│   - 배포/실행 트리거                                      │
│   - 실행 이력, 리포트 뷰                                  │
│   - 러너로부터 결과 이벤트 수신 (HTTP)                    │
└─────┬─────────────┬──────────────────┬────────────────────┘
      │ SQL         │ publish          │ HTTP (배포 트리거)
      ▼             ▼                  ▼
┌──────────┐  ┌──────────┐      ┌───────────────────┐
│  MySQL   │  │ RabbitMQ │      │  Deploy Server    │
└──────────┘  │ (큐)     │      │   (NestJS)        │
              └────┬─────┘      │   - git clone/pull│
                   │ consume    │   - webpack 번들  │
                   ▼            │   - MinIO 업로드  │
              ┌────────────┐    │   - TC↔파일 매핑  │
              │Test Runner │    └─────────┬─────────┘
              │ (N개 scale)│              │
              │  - MinIO   │◄─── S3 API ──┘
              │    다운로드│
              │  - playwright
              │    실행    │              ┌───────┐
              │  - 결과    │──── S3 API ─►│ MinIO │
              │    POST    │              └───────┘
              └────────────┘
```

### 2.2 Docker 컨테이너 구성

| 서비스     | 개수      | 포트 노출   | 역할                           |
| ---------- | --------- | ----------- | ------------------------------ |
| `admin`    | 1         | 3000        | Next.js UI + REST API          |
| `deploy`   | 1         | 4000        | NestJS 내부 API (admin이 호출) |
| `runner`   | N (scale) | 없음        | RabbitMQ consumer              |
| `mysql`    | 1         | 3306        | 데이터                         |
| `rabbitmq` | 1         | 5672, 15672 | 큐 + 관리 UI                   |
| `minio`    | 1         | 9000, 9001  | 오브젝트 스토리지 + 콘솔       |

### 2.3 주요 통신 경로

- Admin → Deploy: 배포 트리거 (HTTP)
- Deploy → Admin: 진행 상태 콜백, 매핑 결과 저장 (HTTP)
- Deploy → MinIO: 번들 업로드 (S3 API)
- Deploy → 외부 Git 원격: clone/pull
- Admin → RabbitMQ: 실행 요청 발행 (AMQP)
- Runner → RabbitMQ: 실행 요청 소비 (AMQP, prefetch 기반 흐름 제어)
- Runner → MinIO: 번들 다운로드, 리포트/artifact 업로드 (S3 API)
- Runner → Admin: 이벤트 스트림, TC 파라미터 조회, 완료 신호 (HTTP)
- Browser → Admin: UI 조작 (HTTP, SSE)

## 3. 모노레포 구성

### 3.1 디렉토리 구조

```
playwright_test_platform_demo/
├── packages/
│   ├── shared/              # 공용 타입, 이벤트 스키마, 상수
│   ├── admin-server/        # Next.js (UI + REST API)
│   │   └── Dockerfile
│   ├── deploy-server/       # NestJS (배포 파이프라인)
│   │   └── Dockerfile
│   ├── test-runner/         # Plain Node + amqplib
│   │   └── Dockerfile
│   └── playwright-lib/      # 커스텀 리포터 + testCase() — 외부 repo용
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── docs/
```

Dockerfile은 각 서비스 패키지 안에 둔다(패키지와 이미지 1:1, 패키지 오너십 명확). Build context는 workspace 의존성(`shared`, `playwright-lib`)을 COPY할 수 있도록 루트로 지정한다:

```yaml
services:
  admin:
    build: { context: ., dockerfile: packages/admin-server/Dockerfile }
  deploy:
    build: { context: ., dockerfile: packages/deploy-server/Dockerfile }
  runner:
    build: { context: ., dockerfile: packages/test-runner/Dockerfile }
```

### 3.2 패키지 매니저 / 런타임

- pnpm workspaces
- Node.js 20
- TypeScript 5.x
- `shared`, `playwright-lib`는 먼저 빌드되어 다른 패키지가 참조

## 4. 데이터 모델 (MySQL 8.0)

타입 표기 주석:

- `uuid` → MySQL `CHAR(36)` (MikroORM `@PrimaryKey({ type: 'uuid' })` 기본 매핑)
- `JSON` → MySQL native JSON 컬럼
- `bigint auto_increment` → MySQL `BIGINT AUTO_INCREMENT`
- 배열 타입 없음 → `JSON` 컬럼에 배열 저장 (`tags`, `requested_test_case_ids`)
- 날짜/시간 → `DATETIME(3)`, 서버는 UTC 기준

### 4.1 엔티티

**`test_cases`** — 테스트 케이스 메타데이터 문서(최신 상태만)

- `id` (text, PK) — "TC-001" 같은 문자열
- `name`, `description`
- `params` (JSON), `expected` (JSON)
- `tags` (JSON (string[]))
- `auto_created` (boolean, default false) — 배포 파이프라인이 자동 생성했는지 여부
- `created_at`, `updated_at`

**`deployments`** — 배포 1회 기록

- `id` (uuid, PK)
- `git_ref` — 브랜치/태그/SHA
- `status` — `pending | cloning | bundling | uploading | mapping | success | failed`
- `error_message` (nullable)
- `started_at`, `finished_at`

**`test_files`** — 배포된 번들의 개별 파일

- `id` (uuid, PK)
- `deployment_id` (FK → deployments)
- `source_path` — 원본 repo 내 상대 경로
- `bundle_key` — MinIO 오브젝트 키
- `created_at`

**`test_case_mappings`** — TC ↔ 파일 매핑 (배포 시점 스냅샷)

- `id` (uuid, PK)
- `deployment_id` (FK)
- `test_case_id` (FK → test_cases)
- `test_file_id` (FK → test_files)
- UNIQUE (`deployment_id`, `test_case_id`)

**`test_runs`** — 실행 1회

- `id` (uuid, PK)
- `deployment_id` (FK)
- `requested_test_case_ids` (JSON (string[]))
- `status` — `queued | running | success | failed | partial`
- `requested_at`, `started_at`, `finished_at`
- `playwright_report_key` (nullable)

**`test_run_items`** — TC 단위 실행 결과

- `id` (uuid, PK)
- `test_run_id` (FK), `test_case_id` (FK), `test_file_id` (FK)
- `status` — `pending | running | passed | failed | skipped | timedout`
- `duration_ms`, `error_message` (nullable)
- `params_snapshot` (JSON), `expected_snapshot` (JSON)
- `started_at`, `finished_at`

**`test_events`** — 스트리밍 리포터의 원시 이벤트

- `id` (bigint auto_increment, PK)
- `test_run_id` (FK), `test_run_item_id` (FK, nullable)
- `event_type` — `test_begin | test_end | step_begin | step_end | stdout | stderr`
- `payload` (JSON)
- `emitted_at`

### 4.2 ERD

```
┌─────────────────────────┐
│      test_cases         │
├─────────────────────────┤
│ PK  id (text)           │  ◄─────────────────┐
│     name                │                    │
│     description         │                    │
│     params (JSON)      │                    │
│     expected (JSON)    │                    │
│     tags (JSON (string[]))       │                    │
│     auto_created (bool) │                    │
│     created_at          │                    │
│     updated_at          │                    │
└─────────────────────────┘                    │
                                               │ N:1
                                               │
┌─────────────────────────┐         ┌──────────┴──────────────────┐
│     deployments         │         │    test_case_mappings       │
├─────────────────────────┤         ├─────────────────────────────┤
│ PK  id (uuid)           │◄────────┤ PK  id (uuid)               │
│     git_ref             │  1:N    │ FK  deployment_id           │
│     status              │         │ FK  test_case_id ───────────┘
│     error_message       │         │ FK  test_file_id ─────┐
│     started_at          │         │     UNIQUE(dep, tc)   │
│     finished_at         │         └───────────────────────┤
└───────────┬─────────────┘                                 │
            │ 1:N                                           │
            ▼                                               │
┌─────────────────────────┐                                 │
│      test_files         │                                 │
├─────────────────────────┤                                 │
│ PK  id (uuid)           │◄────────────────────────────────┘
│ FK  deployment_id       │
│     source_path         │
│     bundle_key          │
│     created_at          │
└─────────────────────────┘
            ▲
            │ N:1
            │
┌───────────┴─────────────┐         ┌─────────────────────────────┐
│     test_run_items      │         │        test_runs            │
├─────────────────────────┤         ├─────────────────────────────┤
│ PK  id (uuid)           │         │ PK  id (uuid)               │
│ FK  test_run_id ────────┼────────►│ FK  deployment_id           │
│ FK  test_case_id        │         │     requested_test_case_ids │
│ FK  test_file_id        │  N:1    │     status                  │
│     status              │         │     requested_at            │
│     duration_ms         │         │     started_at              │
│     error_message       │         │     finished_at             │
│     params_snapshot     │         │     playwright_report_key   │
│     expected_snapshot   │         └──────────────┬──────────────┘
│     started_at          │                        │ 1:N
│     finished_at         │                        │
└───────────┬─────────────┘                        │
            │ 1:N                                  │
            ▼                                      ▼
┌─────────────────────────────────────────────────────┐
│                  test_events                        │
├─────────────────────────────────────────────────────┤
│ PK  id (bigint auto_inc)                            │
│ FK  test_run_id                                     │
│ FK  test_run_item_id (nullable)                     │
│     event_type                                      │
│     payload (JSON)                                 │
│     emitted_at                                      │
└─────────────────────────────────────────────────────┘
```

### 4.3 TC 생명주기 원칙

- **생성**: 배포 파이프라인만 담당. 배포 시 코드를 스캔해 발견된 TC ID를 upsert. 없던 ID는 `auto_created=true`로 INSERT, 있던 것은 그대로 유지.
- **내용 편집**: 사람만 담당. 어드민 UI에서 `PATCH /api/test-cases/:id`. name/description/params/expected/tags 변경.
- **"폐기"**: 명시적 삭제 API 없음. 코드에서 제거 → 새 배포의 매핑에 나타나지 않음 → `is_active=false`로 계산 → runnable 목록에서 제외. 과거 실행 이력은 FK로 보존.
- **실행 재현성**: `test_run_items.params_snapshot` / `expected_snapshot`이 실행 당시 값을 박제. TC 편집이 과거 이력에 영향 주지 않음.

## 5. API 설계

### 5.1 Admin Server 공개 REST API (브라우저용)

**테스트 케이스** (쓰기는 PATCH만)

- `GET /api/test-cases?q=&tag=&active_only=&page=` — 목록 (응답에 `is_active` 계산 필드 포함)
- `GET /api/test-cases/:id` — 상세
- `PATCH /api/test-cases/:id` — 내용 수정
- `GET /api/test-cases/:id/runs` — 해당 TC의 실행 이력
- `GET /api/runnable-test-cases` — 최신 성공 배포 기준 실행 가능한 TC 목록

**배포**

- `GET /api/deployments?status=&page=` — 목록
- `POST /api/deployments` — 트리거. body: `{ git_ref }`
- `GET /api/deployments/:id` — 상세 + 진행 상태
- `GET /api/deployments/:id/test-files` — 번들에 포함된 파일

**실행**

- `POST /api/runs` — 실행 요청. body: `{ test_case_ids, param_overrides? }`
- `GET /api/runs?page=` — 목록
- `GET /api/runs/:id` — 상세 (items 포함)
- `GET /api/runs/:id/events/stream` — SSE로 이벤트 실시간 푸시
- `GET /api/runs/:id/report` — MinIO presigned URL (HTML 리포트)

### 5.2 Admin Server 내부 REST API (러너/배포 서버 전용)

**호출자**: `deploy-server`, `test-runner` 컨테이너. 브라우저/외부에서 호출되지 않음.

**보호 장치 (이중 방어)**

1. **네트워크 레벨**: Next.js middleware에서 `/internal/*` 경로에 대해 요청의 `Host` 헤더를 검사. Docker 내부 DNS(`admin:3000`)일 때만 통과, 그 외(`localhost:3000`, public IP 등)는 404 반환. 브라우저로 실수 호출 및 host 노출된 포트로의 접근 차단.
2. **애플리케이션 레벨**: 모든 `/internal/*` 요청은 `X-Internal-Token` 헤더를 요구. 값이 `.env`의 `INTERNAL_API_TOKEN`과 일치하지 않으면 401. admin·deploy·runner가 같은 토큰을 공유.

**엔드포인트**

- `POST /internal/deployments/:id/status` — 진행 상태 업데이트
- `POST /internal/deployments/:id/mappings` — 파일 + TC upsert + 매핑 일괄 저장 (단일 트랜잭션)
- `GET /internal/runs/:id/test-case/:tc_id/resolve` — 실행 시점 params/expected 조회 (snapshot 반환)
- `POST /internal/runs/:id/events` — 리포터 이벤트 청크 수신
- `POST /internal/runs/:id/items/:item_id/status` — item 상태 업데이트
- `POST /internal/runs/:id/complete` — run 전체 완료 신호

### 5.3 Deploy Server REST API (NestJS)

- `POST /deploy` — body: `{ deployment_id, git_ref }`. 202 즉시 반환, 비동기 처리.
- `GET /health` — 헬스체크

### 5.4 RabbitMQ 이벤트

- Exchange: `test-runs` (topic), Queue: `test-run-items`, Routing key: `run.item.execute`
- DLQ: `test-runs-dlq`
- 페이로드:

```json
{
  "run_id": "uuid",
  "item_id": "uuid",
  "deployment_id": "uuid",
  "test_case_id": "TC-001",
  "test_file_bundle_key": "deployments/<dep_id>/files/cart.spec.js",
  "admin_base_url": "http://admin:3000"
}
```

- 러너는 `prefetch_count = MAX_CONCURRENT`로 수신, manual ack.
- 인프라 레벨 실패는 nack → DLQ. 테스트 자체 실패는 정상 ack + admin에 failed 상태 보고.

### 5.5 MinIO 오브젝트 레이아웃

```
bucket: test-platform
├── deployments/<deployment_id>/
│   └── files/<source_path>.js
├── runs/<run_id>/
│   ├── report/
│   │   ├── index.html
│   │   └── data/...
│   └── artifacts/<item_id>/
│       ├── screenshot.png
│       ├── video.webm
│       └── trace.zip
```

## 6. 파이프라인 시퀀스

### 6.1 배포

1. Browser → Admin: `POST /api/deployments { git_ref }`
2. Admin: `deployments` INSERT (status=pending) → Deploy에 `POST /deploy` 호출, 202 반환
3. Deploy:
   - (status=cloning 콜백) git clone/pull (workspace)
   - (status=bundling 콜백) 각 `*.spec.ts` → webpack 독립 entry → `dist/<source_path>.js`
   - 원본 소스에 정규식 `/testCase\(\s*["'`]([^"'`]+)["'`]/g`로 TC ID 추출
   - (status=uploading 콜백) 번들 JS들 MinIO PUT
   - (status=mapping 콜백) `POST /internal/deployments/:id/mappings` — files + TC upsert(auto_created=true for new) + mappings 저장 (단일 트랜잭션)
   - 성공 시 status=success, 실패 시 status=failed + error_message
4. Browser: `GET /api/deployments/:id` 폴링으로 진행 표시

### 6.2 실행

1. Browser → Admin: `POST /api/runs { test_case_ids }`
2. Admin:
   - `test_runs` INSERT (status=queued)
   - TC별로 `test_run_items` INSERT. 이때 현재 `test_cases.params/expected`를 복사해 `params_snapshot`/`expected_snapshot` 박제
   - 각 item에 대해 `run.item.execute` 메시지를 RabbitMQ에 발행
   - 202 반환
3. RabbitMQ → Runner(s): prefetch 한도 내에서 메시지 분배. 다수의 runner가 있으면 자연스럽게 분산.
4. Runner (각 item마다):
   - MinIO에서 번들 JS 다운로드 (workspace/<item_id>/)
   - env 주입: `PLATFORM_RUN_ID`, `PLATFORM_ITEM_ID`, `PLATFORM_ADMIN_URL`, `PLATFORM_REPORTER_*`, `SUT_BASE_URL`
   - `npx playwright test <file>` 실행 (config는 커스텀 리포터 등록)
   - 테스트 코드의 `testCase()` 호출 → admin의 `/resolve`로 params/expected 조회 → 콜백에 주입
   - 리포터: 이벤트를 버퍼에 쌓고 chunk_size 또는 flush_interval마다 `POST /internal/runs/:id/events`
   - 종료 후 report 디렉토리 + artifact MinIO 업로드
   - `POST /internal/runs/:id/items/:item_id/status` (passed/failed/…)
   - 메시지 ack
5. Admin: 모든 items 완료 감지 → `test_runs.status` 롤업 (success/failed/partial)
6. Browser: SSE로 실시간 이벤트 수신, 완료 시 리포트 뷰 표시

### 6.3 실패 처리

| 실패 지점                 | 처리                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| Git clone 실패            | deployment.status=failed, error_message 기록                     |
| 번들링 실패               | 동일                                                             |
| MinIO 업로드 실패         | 동일 (orphan 객체는 데모 범위 밖)                                |
| Runner 번들 다운로드 실패 | item 상태 failed + admin 보고, 메시지 nack → DLQ                 |
| Playwright 크래시         | 리포터가 잡아 failed 이벤트 전송, 메시지 정상 ack                |
| Runner 프로세스 크래시    | ack 안 했으므로 RabbitMQ 재전달, 다른 러너가 재시도              |
| Admin 일시 장애           | 러너 리포터가 내부 버퍼에 유지하며 재시도, 타임아웃 초과 시 nack |

## 7. 컴포넌트 내부 구조

### 7.1 `packages/shared`

```
shared/src/
├── events/
│   ├── reporter-events.ts      # 리포터 이벤트 타입
│   └── queue-messages.ts       # RabbitMQ 메시지 스키마
├── dto/
│   ├── test-case.ts
│   ├── deployment.ts
│   └── run.ts
├── constants/
│   ├── statuses.ts
│   └── event-types.ts
└── utils/
```

**책임**: 타입·상수만. 런타임 의존성 없음. 모든 패키지의 공용 계약.

### 7.2 `packages/playwright-lib`

사용자 외부 테스트 repo가 import하는 라이브러리. npm publish 가능한 형태(실제 publish는 안 해도 됨).

```
playwright-lib/src/
├── test-case.ts     # testCase(id, callback) — Playwright test/step으로 감쌈
├── reporter.ts     # StreamingReporter (Playwright Reporter 인터페이스 구현)
├── client.ts       # admin-server HTTP 클라이언트 (resolve, events)
└── index.ts
```

**`test-case.ts`**: `testCase(id, fn)` 내부에서 `test()` + `test.step()` 사용. 실행 중 `client.resolve()` 호출해서 `{params, expected}`를 fn에 주입. `run_id`/`item_id`는 `PLATFORM_*` env에서 읽음.

**`reporter.ts`**: Playwright `Reporter` 인터페이스의 `onTestBegin`, `onStepBegin`, `onStepEnd`, `onTestEnd`, `onEnd` 구현. 버퍼가 `chunkSize`에 도달하거나 `flushIntervalMs`가 지나면 admin으로 POST. `onEnd`에서 최종 flush + `/complete` 호출. 메모리에 전체 결과를 쌓지 않음으로써 OOM 방지.

**`client.ts`**: fetch 래퍼 + 재시도 + 타임아웃. POST 실패 시 로컬 버퍼 유지 후 재시도, N회 실패 시 process.exit(1).

### 7.3 `packages/admin-server` (Next.js)

```
admin-server/
├── app/
│   ├── (ui)/
│   │   ├── test-cases/
│   │   ├── deployments/
│   │   └── runs/
│   └── api/
│       ├── test-cases/
│       ├── deployments/
│       ├── runs/
│       ├── runnable-test-cases/
│       └── internal/
├── middleware.ts           # /internal/* 가드 (Host 헤더 + X-Internal-Token 검증)
├── src/
│   ├── services/
│   │   ├── test-case-service.ts
│   │   ├── deployment-service.ts
│   │   ├── run-service.ts
│   │   └── event-ingest-service.ts
│   ├── entities/           # MikroORM 엔티티 (@Entity decorators)
│   ├── repositories/       # MikroORM EntityManager/Repository wrap
│   ├── queue/              # RabbitMQ publisher (amqplib)
│   ├── storage/            # MinIO client, presigned URL
│   └── db/                 # 스키마, 마이그레이션
└── components/             # React UI
```

**레이어 원칙**

- `app/api/*`: HTTP 파싱과 응답 직렬화만
- `services/`: 비즈니스 로직, 트랜잭션 경계
- `repositories/`: DB 쿼리 캡슐화
- services는 HTTP/Next.js에 의존하지 않음 → 단위 테스트 용이

**주요 서비스**

- `deployment-service`: 생성·상태 전이, 매핑 저장 트랜잭션(파일 + TC upsert + mappings)
- `run-service`: run 생성 시 params_snapshot 박제, 큐 발행, items 완료 감지 후 run 상태 롤업
- `event-ingest-service`: 리포터 이벤트 배치 insert + item 상태 전이

**UI**

- SSE로 run 실시간 업데이트 (`/api/runs/:id/events/stream`)
- Playwright HTML 리포트는 iframe + MinIO presigned URL

### 7.4 `packages/deploy-server` (NestJS)

```
deploy-server/src/
├── main.ts
├── app.module.ts
├── deploy/
│   ├── deploy.module.ts
│   ├── deploy.controller.ts     # POST /deploy, GET /health
│   ├── deploy.service.ts        # orchestrator
│   └── dto/
├── pipeline/
│   ├── pipeline.module.ts
│   ├── clone.service.ts         # git clone/pull
│   ├── bundle.service.ts        # webpack programmatic API
│   ├── parse.service.ts         # 정규식 TC 추출
│   └── upload.service.ts        # MinIO PUT
├── admin/
│   ├── admin.module.ts
│   └── admin-client.service.ts  # @nestjs/axios
├── config/
│   └── configuration.ts         # @nestjs/config
└── workspace/                   # 런타임 작업 디렉토리
```

**책임**

- `DeployController`: 202 즉시 반환, `DeployService.run()`을 비동기로 시작
- `DeployService`: 파이프라인 단계 조율, 각 단계 결과를 `AdminClientService`로 콜백
- 파이프라인 서비스는 각각 순수한 입출력 (`clone(ref)→path`, `bundle(path)→files`, `parse(source)→refs`, `upload(file)→key`)
- workspace는 컨테이너 재시작 시 초기화, 매 배포마다 fresh clone (단순성 우선)

**번들링 제약**

- 각 `*.spec.ts`는 독립 entry. 외부 의존성은 인라인.
- 정규식은 **원본 소스**에 실행 (minify 전)
- 동적 TC ID, 조건부 `testCase()` 호출은 지원하지 않음 — README에 명시

### 7.5 `packages/test-runner`

```
test-runner/src/
├── consumer.ts              # amqplib, prefetch 설정, consume 루프
├── executor.ts              # item 1개 실행 오케스트레이션
├── playwright-runner.ts     # child_process.spawn("npx playwright test ...")
├── bundle-fetcher.ts        # MinIO GET
├── artifact-uploader.ts     # report/artifact PUT
└── workspace/               # per-item 작업 디렉토리
```

**executor 흐름**

1. 메시지 수신 → `bundle-fetcher`로 JS 다운로드
2. env 주입 (PLATFORM\_\*, SUT_BASE_URL 등)
3. `playwright-runner`가 Playwright CLI 실행 (config의 reporter에 StreamingReporter 등록)
4. 종료 후 `artifact-uploader`가 리포트/artifact 업로드
5. admin에 item 상태 POST
6. 메시지 ack (인프라 실패 시에만 nack → DLQ)

**동시성**

- `consumer.ts`가 `prefetch_count = MAX_CONCURRENT`
- 각 메시지는 별도 Promise로 병렬 처리
- ack/nack은 개별 완료 시점

**격리**: `workspace/<item_id>/` 서브디렉토리 사용, 실행 종료 시 삭제

### 7.6 Docker 구성

```yaml
# docker-compose.yml (요약)
services:
  admin:
    build: { context: ., dockerfile: packages/admin-server/Dockerfile }
    ports: ['3000:3000']
  deploy:
    build: { context: ., dockerfile: packages/deploy-server/Dockerfile }
    ports: ['4000:4000']
  runner:
    build: { context: ., dockerfile: packages/test-runner/Dockerfile }
    # 수평 확장은 `docker compose up --scale runner=N`
  mysql: { image: mysql:8.0, ports: ['3306:3306'], volumes: [mysql-data:/var/lib/mysql] }
  rabbitmq: { image: rabbitmq:3-management, ports: ['15672:15672'] }
  minio: { image: minio/minio, ports: ['9000:9000', '9001:9001'] }
volumes:
  mysql-data: {}
  rabbitmq-data: {}
  minio-data: {}
```

**러너 이미지**

- 베이스: `mcr.microsoft.com/playwright:v1.xx.x-noble` (브라우저 포함)
- pnpm + workspace + built `playwright-lib`, `shared` 포함
- 테스트 번들은 이미지에 굽지 않음 (실행 시 MinIO에서 다운로드)

**수평 확장**: `docker compose up --scale runner=3`. RabbitMQ가 자동 분배.

## 8. 환경변수

루트 `.env`:

```bash
# DB
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

# 서비스 간 URL
ADMIN_URL=http://admin:3000
DEPLOY_URL=http://deploy:4000

# SUT (host 머신의 웹앱)
SUT_BASE_URL=http://host.docker.internal:8080

# Git 원격 저장소
GIT_REPO_URL=https://github.com/<user>/<repo>.git
GIT_REPO_BRANCH=main
GIT_AUTH_TOKEN=

# 실행 제어
MAX_CONCURRENT=2
REPORTER_CHUNK_SIZE=50
REPORTER_FLUSH_INTERVAL_MS=2000

# 내부 API 보호 (admin/deploy/runner가 공유)
INTERNAL_API_TOKEN=change-me-to-a-long-random-string
```

**러너 실행 시점 주입**: `PLATFORM_RUN_ID`, `PLATFORM_ITEM_ID`, `PLATFORM_ADMIN_URL`, `PLATFORM_REPORTER_CHUNK_SIZE`, `PLATFORM_REPORTER_FLUSH_INTERVAL_MS`

## 9. 테스트 전략

### 9.1 자동화 테스트

- **shared**: Vitest 단위 테스트 (순수 타입/유틸)
- **playwright-lib**:
  - `testCase()` — HTTP 클라이언트 mock
  - `reporter.ts` — Playwright Reporter 이벤트 주입으로 버퍼/플러시 검증
- **admin-server**:
  - 서비스 단위 테스트 (repository mock)
  - API 통합 테스트 (testcontainers로 MySQL 띄움)
- **deploy-server (NestJS)**:
  - 파이프라인 서비스 단위 테스트
  - e2e: @nestjs/testing + git·MinIO mock
- **test-runner**:
  - executor 단위 테스트 (bundle-fetcher / playwright-runner / uploader mock)

### 9.2 수동 end-to-end 검증 시나리오

1. 외부 테스트 repo 준비 (tests/cart.spec.ts에 testCase 2~3개)
2. host에서 간단한 웹앱 기동 (예: `python -m http.server 8080`)
3. 어드민 UI에서 배포 → status 진행 확인
4. MinIO 콘솔에서 번들 업로드 확인
5. TC 목록에 자동 생성된 항목 확인, params 편집
6. 2개 TC 선택 후 실행 → runner 병렬 실행 (scale=3 시)
7. 어드민 UI SSE 이벤트 스트림 확인
8. 실행 완료 후 HTML 리포트 뷰
9. `docker compose stop <runner>`로 실행 중 장애 복구 확인
10. DB에서 `params_snapshot` 등 이력 확인

## 10. 사용자 테스트 repo 구조 (외부)

```
user-test-repo/
├── package.json            # @platform/playwright-lib 의존성
├── playwright.config.ts    # StreamingReporter 등록
└── tests/
    ├── cart.spec.ts
    └── checkout.spec.ts
```

`playwright.config.ts` 예:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    [
      '@platform/playwright-lib/reporter',
      {
        chunkSize: Number(process.env.PLATFORM_REPORTER_CHUNK_SIZE ?? 50),
        flushIntervalMs: Number(process.env.PLATFORM_REPORTER_FLUSH_INTERVAL_MS ?? 2000),
      },
    ],
  ],
  use: { baseURL: process.env.SUT_BASE_URL },
});
```

`tests/cart.spec.ts` 예:

```ts
import { testCase } from '@platform/playwright-lib';

testCase('TC-001', async ({ page, params, expected }) => {
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.count')).toHaveText(String(expected.count));
});
```

## 11. 주요 결정 요약

| 결정                         | 선택                                                    | 대안                             |
| ---------------------------- | ------------------------------------------------------- | -------------------------------- |
| 프로젝트 구성                | 모노레포 + pnpm workspaces                              | 멀티레포, 단일 package           |
| 어드민 프레임워크            | Next.js (UI+API 통합)                                   | REST-only + 별도 SPA             |
| 배포 서버 프레임워크         | NestJS                                                  | Express, Fastify                 |
| 테스트 러너                  | Plain Node + amqplib                                    | NestJS                           |
| 메시지 큐                    | RabbitMQ                                                | Redis/BullMQ, pg-boss            |
| DB                           | MySQL 8.0                                               | PostgreSQL, SQLite, MongoDB      |
| DB 클라이언트                | MikroORM                                                | Prisma, Kysely, TypeORM          |
| 스토리지                     | MinIO (S3 호환)                                         | Docker named volume, HTTP 릴레이 |
| Git 소스                     | 원격 repo clone/pull                                    | 로컬 repo, 파일 업로드           |
| TC 매핑 방식                 | 정규식 정적 파싱                                        | AST, 런타임 등록                 |
| TC 생성                      | 배포 파이프라인 자동 upsert                             | 사람이 POST로 등록               |
| TC 삭제                      | 명시적 삭제 없음 (코드에서 제거 → is_active=false 계산) | soft delete 컬럼                 |
| 인증                         | 없음                                                    | 로그인, 사용자 관리              |
| 동시성 제어                  | prefetch + MAX_CONCURRENT + --scale                     | 단일 러너, 단일 실행             |
| 커스텀 리포터 / `testCase()` | 둘 다 구현                                              | 리포터만, 둘 다 생략             |

## 12. 산출물

- 본 문서: `docs/superpowers/specs/2026-04-12-playwright-test-platform-demo-design.md`
- `README.md` — 기동 순서, 사용자 테스트 repo 작성 가이드 (구현 시 작성)
- `docs/ARCHITECTURE.md` — 다이어그램 발췌 (구현 시 작성)
