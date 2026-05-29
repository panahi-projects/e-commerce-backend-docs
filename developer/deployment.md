# Deployment

The MVP ships as a single Node.js process. Scale by adding worker pods for the mail queue and (eventually) extracting modules into separate services.

> [!TIP]
> For step-by-step instructions per platform (AWS EC2, DigitalOcean, ArvanCloud, Windows, Docker-on-anywhere, etc.) see the dedicated [Deployment section](/deployment/). This page is the engineering-overview view — what's in the box and how it runs.

## Build

```bash
npm install --omit=dev
npm run build
```

Output goes to `dist/`. `tsc-alias` rewrites path aliases (`@common/*`, `@plugins/*`, …) to relative paths so the built code runs without `tsconfig-paths/register`.

## Runtime requirements

| Service     | Version | Required?                                                                                                           |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| Node.js     | 22.x    | Yes                                                                                                                 |
| MongoDB     | 6.x +   | Yes                                                                                                                 |
| Redis       | 7.x +   | Yes — feature-flag cache. Set `FEATURE_FLAGS_CACHE_TTL_SECONDS=0` if you want to bypass it. Mail queue is optional. |
| SMTP server | —       | Optional. The `mail` module logs to stdout when SMTP isn't reachable.                                               |

## Production env checklist

- `NODE_ENV=production`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` at ≥32 chars, rotated per deployment.
- `MONGODB_URI` with auth; `MONGODB_DB_NAME` set.
- `ENABLED_PLUGINS` matches what this deployment should serve.
- `CORS_ORIGINS` is the exact frontend origin list (not `*`).
- `MAIL_QUEUE_ENABLED=true` once a worker pod is consuming the queue.
- `SWAGGER_ENABLED=true` to expose the Swagger UI, `false` to hide it.
- `LOG_LEVEL=info` (or `warn` in high-volume environments).

## Health endpoints

The `HealthController` (`src/health/health.controller.ts`) exposes two endpoints:

| Endpoint                      | Purpose                               | Response on success     |
| ----------------------------- | ------------------------------------- | ----------------------- |
| `GET /api/v1/health`          | Full readiness check (MongoDB + heap) | Terminus JSON, 200      |
| `GET /api/v1/health/liveness` | Liveness probe — process is alive     | `{ status: "ok" }`, 200 |

The readiness check (`/health`) runs:

- **MongoDB ping** — 3 s timeout
- **Memory heap** — fails if V8 heap exceeds 512 MB

The liveness check (`/health/liveness`) always returns 200 if the NestJS process is running. Use it for platforms that need a simple "is it alive?" probe (e.g. Liara, Kubernetes liveness probe).

> [!IMPORTANT]
> **Do not add a Docker `HEALTHCHECK` instruction when deploying to Liara PaaS.** Liara has its own port-based health checking. A Docker HEALTHCHECK conflicts with it and causes deployments to fail with "container is unhealthy" even when the app is running correctly. For other platforms (Kubernetes, ECS, etc.), wire the liveness endpoint as the probe.

## Dockerfile — registry mirrors

The Dockerfile uses build args for the Node.js base image and npm registry:

```dockerfile
ARG NODE_IMAGE=docker-mirror.liara.ir/node:22-alpine
ARG NPM_REGISTRY=https://package-mirror.liara.ir/repository/npm/
```

| Context        | What happens                                                                          |
| -------------- | ------------------------------------------------------------------------------------- |
| `liara deploy` | Defaults are used — pulls from Liara's mirrors (fast from Iran)                       |
| GitHub Actions | CI overrides with `node:22-alpine` and `https://registry.npmjs.org/` via `build-args` |
| Local Docker   | Override manually: `docker build --build-arg NODE_IMAGE=node:22-alpine .`             |

## CI pipeline

The project has two GitHub Actions workflows:

| Workflow | File                         | Trigger                                     | What it does                                          |
| -------- | ---------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| **CI**   | `.github/workflows/ci.yml`   | Push/PR to `main`, `develop`, `pre-release` | Lint → Build → Unit tests → Docker image verification |
| **Docs** | `.github/workflows/docs.yml` | Push to `main` (docs/ changes)              | Builds VitePress docs and deploys to GitHub Pages     |

The CI workflow does **not** deploy to Liara — deployment is done manually via `liara deploy` from the developer's machine.

## Bootstrap error handling

`main.ts` wraps the bootstrap function with `.catch()` so startup errors are always visible in the logs:

```typescript
bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
```

Step-by-step `[Bootstrap]` log messages mark each phase (app creation, Swagger setup, HTTP server start). If the app fails to start, check for `Bootstrap failed:` in the logs.

## Horizontal scaling

The app is stateless except for the refresh-token table and the feature-flag cache, both stored externally. You can run multiple replicas behind a load balancer with no sticky sessions.

## Mail worker

When `MAIL_QUEUE_ENABLED=true`, mail jobs are pushed to BullMQ (Redis). Run one or more processes with the same image — the `MailProcessor` will participate in the queue. If you don't want a dedicated worker pod, leave it `false` and mails dispatch inline.

## Restart on plugin changes

Plugin loading happens at boot from `ENABLED_PLUGINS`. Adding or removing a plugin from the env list requires a process restart. **Per-tenant** plugin enable/disable does **not** require a restart — that's the runtime flag layer.
