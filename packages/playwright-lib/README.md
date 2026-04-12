# @platform/playwright-lib

Custom `testCase()` wrapper + streaming Playwright reporter. External test repos import this to emit run events to the admin server.

## Scripts

```bash
pnpm --filter @platform/playwright-lib test
pnpm --filter @platform/playwright-lib build
```

## Exports

- `testCase(id, callback)` — Playwright `test()` wrapper; resolves `{ params, expected }` at run time from the admin server.
- `StreamingReporter` — Playwright `Reporter`; buffered chunked POST of events, final item-status update on `onEnd`.
- `AdminClient` — fetch wrapper with retry / timeout / `X-Internal-Token` auth.

## Runner-side Environment Variables

- `PLATFORM_RUN_ID`
- `PLATFORM_ITEM_ID`
- `PLATFORM_ADMIN_URL`
- `PLATFORM_INTERNAL_API_TOKEN`
- `PLATFORM_REPORTER_CHUNK_SIZE`
- `PLATFORM_REPORTER_FLUSH_INTERVAL_MS`
