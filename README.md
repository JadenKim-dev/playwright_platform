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
