# Setup

Get the project running locally.

## Prerequisites

- Node.js 20.x or later (matches the `@types/node` major).
- MongoDB 6.x running locally (or remote URI).
- Redis 7.x running locally (used by feature-flag cache; mail queue is optional).
- pnpm or npm — examples use npm.

## Install

```bash
git clone <repo-url>
cd e-commerce-backend
npm install
```

## Environment

```bash
cp .env.example .env
```

The required vars are validated by Joi (`src/config/configuration.schema.ts`) at bootstrap. The most important ones:

| Var                                       | Purpose                                                |
| ----------------------------------------- | ------------------------------------------------------ |
| `MONGODB_URI`, `MONGODB_DB_NAME`          | Mongo connection                                       |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | At least 32 chars each                                 |
| `REDIS_HOST`, `REDIS_PORT`                | Required for the feature-flag cache                    |
| `ENABLED_PLUGINS`                         | Comma-separated plugin keys to load                    |
| `FEATURE_FLAGS_CACHE_TTL_SECONDS`         | Cache TTL in seconds; default `300`                    |
| `MAIL_QUEUE_ENABLED`                      | `true` to dispatch via BullMQ, `false` for inline send |

Generate JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Seed

```bash
npm run seed
```

Idempotent. Creates three tenants (`default`, `starter-client`, `growth-client`), seed users (admin/staff/customer), categories, products, sample orders, and sample coupons/banners/reviews.

## Run

```bash
# Dev with HMR
npm run start:dev

# Production
npm run build
npm run start:prod
```

By default the API serves on `http://localhost:3000/api/v1`. Swagger UI at `/api/v1/docs`.

## Test

```bash
npm test              # unit tests
npm run test:cov      # with per-file coverage thresholds
npm run test:e2e      # Jest e2e config under test/
```

## Lint / format

```bash
npm run lint          # ESLint with --fix
npm run format        # Prettier
```

A `lint-staged` pre-commit hook runs both on staged files.

## Docs site

```bash
npm run docs:dev      # local docs server at http://localhost:5173/
npm run docs:build    # static output in docs/.vitepress/dist/
```
