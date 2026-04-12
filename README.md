# Playwright Test Platform Demo

A self-built demo of a Playwright-based test automation platform. See `docs/superpowers/specs/2026-04-12-playwright-test-platform-demo-design.md` for the design document.

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

Packages to be added in later phases: `playwright-lib`, `admin-server`, `deploy-server`, `test-runner`.

## Development Scripts

```bash
pnpm build       # Build the entire workspace
pnpm test        # Test the entire workspace
pnpm lint        # ESLint
pnpm format      # Prettier
```
