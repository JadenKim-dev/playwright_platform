# @platform/admin-server

The admin-facing Next.js server for the Playwright test platform. It manages deployments, test cases and files, test runs, and raw reporter events.

## Scripts

- `pnpm --filter @platform/admin-server dev` — development server (port 3000)
- `pnpm --filter @platform/admin-server build` — Next.js production build
- `pnpm --filter @platform/admin-server test` — unit tests (vitest)
- `pnpm --filter @platform/admin-server test:integration` — integration tests
- `pnpm --filter @platform/admin-server mikro-orm` — MikroORM CLI (migrations, etc.)

## Entity relationships

ERD of the MikroORM-managed entities. Labels use `cascade` / `restrict` to indicate the `deleteRule` on each foreign key.

```mermaid
erDiagram
    Deployment ||--o{ TestFile : "has (cascade)"
    Deployment ||--o{ TestCaseMapping : "has (cascade)"
    Deployment ||--o{ TestRun : "triggers (restrict)"

    TestCase ||--o{ TestCaseMapping : "mapped by (restrict)"
    TestCase ||--o{ TestRunItem : "executed as (restrict)"

    TestFile ||--o{ TestCaseMapping : "bundles (cascade)"
    TestFile ||--o{ TestRunItem : "runs from (restrict)"

    TestRun ||--o{ TestRunItem : "contains (cascade)"
    TestRun ||--o{ TestEvent : "emits (cascade)"
    TestRunItem ||--o{ TestEvent : "emits (cascade, nullable)"

    Deployment {
        string   id PK
        string   gitRef
        enum     status
        text     errorMessage
        datetime startedAt
        datetime finishedAt
    }

    TestCase {
        string   id PK
        string   name
        text     description
        json     params
        json     expected
        json     tags
        boolean  autoCreated
        datetime createdAt
        datetime updatedAt
    }

    TestFile {
        string   id PK
        string   deployment_id FK
        string   sourcePath
        string   bundleKey
        datetime createdAt
    }

    TestCaseMapping {
        string id PK
        string deployment_id FK
        string test_case_id FK
        string test_file_id FK
    }

    TestRun {
        string   id PK
        string   deployment_id FK
        json     requestedTestCaseIds
        enum     status
        datetime requestedAt
        datetime startedAt
        datetime finishedAt
        string   playwrightReportKey
    }

    TestRunItem {
        string   id PK
        string   test_run_id FK
        string   test_case_id FK
        string   test_file_id FK
        enum     status
        integer  durationMs
        text     errorMessage
        json     paramsSnapshot
        json     expectedSnapshot
        datetime startedAt
        datetime finishedAt
    }

    TestEvent {
        bigint   id PK
        string   test_run_id FK
        string   test_run_item_id FK
        enum     eventType
        json     payload
        datetime emittedAt
    }
```

## Entity summary

- **Deployment** — A bundle deployment keyed by a Git reference (`gitRef`). Tracks lifecycle status and any error message.
- **TestCase** — A logical test case recognized by the platform, with parameters, expectations, and tags. `autoCreated` marks cases discovered automatically during ingestion.
- **TestFile** — A compiled test bundle file that belongs to a deployment. `bundleKey` points to its location in storage.
- **TestCaseMapping** — Join table recording which `TestCase` lives in which `TestFile` for a given `Deployment`. `(deployment, testCase)` is unique.
- **TestRun** — A run request targeting a deployment. Holds the requested `TestCase` ids, status, timing, and the Playwright report key.
- **TestRunItem** — Per-case execution result within a `TestRun`, including a snapshot of `params` / `expected` at run time plus status and error message.
- **TestEvent** — Raw Playwright reporter events. Always tied to a `TestRun`; optionally tied to a `TestRunItem` (run-level events such as stdout may have no item).
