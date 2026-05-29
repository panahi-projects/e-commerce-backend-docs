# Developer Overview

This is the engineering documentation for the e-commerce platform. It assumes you've worked with NestJS, MongoDB/Mongoose, and TypeScript before.

## Stack at a glance

- **Runtime:** Node.js + NestJS 11 (Express adapter)
- **Language:** TypeScript 5.7 strict
- **DB:** MongoDB via Mongoose 9
- **Cache:** Redis (ioredis)
- **Queue (optional):** BullMQ on Redis (mail dispatch)
- **Auth:** JWT (access + refresh) with httpOnly cookies for the refresh token
- **i18n:** `nestjs-i18n` (en + fa)
- **Docs/API:** Swagger via `@nestjs/swagger`
- **Tests:** Jest + ts-jest, per-file coverage thresholds

## The two-layer plugin architecture

Non-essential features are packaged as **plugins** loaded at boot from the `ENABLED_PLUGINS` env var. Within each loaded plugin, individual sub-features are gated per tenant via **feature flags** stored in MongoDB and cached in Redis. Start with the [Plugin System Overview](./plugins/overview) for the full picture.

## Reading order

1. [Setup](./setup) — get the project running locally.
2. [Architecture](./architecture) — module map, layer diagram, key abstractions.
3. [API Reference](./api-reference) — what every endpoint group does.
4. [Auth Flow](./auth-flow) — dual-token JWT scheme.
5. [Plugin System Overview](./plugins/overview) — start here for plugin work.

For task-oriented work, jump straight to the section you need.

## Repository conventions

- File naming: `kebab-case.type.ts` (e.g. `coupon-validator.service.ts`).
- Class naming: `PascalCase`.
- Path aliases: `@common/*`, `@config`, `@modules/*`, `@plugins/*`, `@database/*`, `@mail/*`.
- Commits: Conventional Commits, enforced by commitlint on `commit-msg`.
- Lint/format: pre-commit `lint-staged` runs `eslint --fix` + `prettier --write`.
- Tests: unit tests live next to the file they cover as `*.spec.ts`.

See [Conventions](../ai/conventions) for the full canonical list (the AI doc is the source of truth — same rules apply to humans).
