# Playwright Test Platform

A self-built demo of a Playwright-based test automation platform.

## Requirements

- Node.js 20 (`nvm use` supported)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9 --activate`)
- Docker + Docker Compose v2

## Initial Setup

```bash
pnpm install
cp .env.example .env
# Adjust .env values if needed (defaults work for local startup)
```

## Starting Infrastructure (MySQL / RabbitMQ / MinIO)

```bash
docker compose up -d
docker compose ps   # Verify all three services are healthy
```

Stopping:

```bash
docker compose down            # Preserve volumes
docker compose down -v         # Delete volumes as well
```

## Packages

- `packages/shared` — Shared types, event schemas, DTOs, and constants (no runtime dependencies)
- `packages/playwright-lib` — Custom `testCase()` wrapper + streaming Playwright reporter. External test repos import this to emit run events to the admin server.

Packages to be added in later phases: `admin-server`, `deploy-server`, `test-runner`.

## Development Scripts

```bash
pnpm build       # Build the entire workspace
pnpm test        # Test the entire workspace
pnpm lint        # ESLint
pnpm format      # Prettier
```

## Phase 3a: admin-server core

```bash
# Unit tests (mock-based, fast)
pnpm --filter @platform/admin-server test:unit

# Integration tests (testcontainers MySQL — first run downloads the image)
pnpm --filter @platform/admin-server test:integration

# Type check
pnpm --filter @platform/admin-server exec tsc --noEmit -p tsconfig.json
```

`POST /api/deployments` and `POST /api/runs` work end-to-end against the database; the deploy-server call and RabbitMQ publish are no-op stubs in Phase 3a (real wiring lands in Phase 3b).
