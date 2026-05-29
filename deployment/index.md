# Deployment

This section explains how to deploy the e-commerce backend to a production host. It is broken down by target so you can jump straight to the platform you're using.

Every guide produces the **same runtime topology**: one NestJS app container, one MongoDB container, one Redis container, all orchestrated by the project's existing `docker-compose.prod.yml`. The differences live in _how_ you provision the host, _how_ you open the firewall, and _what_ you do for HTTPS — not in the application stack itself.

## Pick a target

| If you have…                                             | Go to                                               |
| -------------------------------------------------------- | --------------------------------------------------- |
| A plain Ubuntu / Debian VPS from Hetzner, Linode, OVH, … | [Generic Ubuntu/Debian VPS](./ubuntu-debian-vps)    |
| An ArvanCloud instance (Iran)                            | [ArvanCloud](./arvancloud)                          |
| A Liara account (Iran) — PaaS or IaaS                    | [Liara](./liara)                                    |
| An AWS account                                           | [AWS EC2](./aws-ec2)                                |
| A DigitalOcean account                                   | [DigitalOcean Droplet](./digitalocean)              |
| Any host with Docker — bare metal, NAS, home lab, etc.   | [Docker Compose (any host)](./docker-compose)       |
| A Windows machine or Windows Server                      | [Windows Server / Docker Desktop](./windows-server) |

Before you start, read [Prerequisites](./prerequisites) once — it covers the bits that are identical on every platform (env vars, JWT secret generation, the Docker engine install, the project's npm scripts). The per-platform pages link back to it.

## What every deployment looks like

```
                ┌─────────────────────────────────────┐
                │   Reverse proxy (Nginx / ALB / …)   │
                │           :80 / :443                │
                └────────────────┬────────────────────┘
                                 │
                                 ▼
   ┌─────────────────────────────────────────────────────────┐
   │                     Docker network                       │
   │                                                          │
   │   ┌─────────────┐    ┌──────────────┐    ┌──────────┐   │
   │   │  app:3000   │───▶│  mongo:27017 │    │ redis:6379│   │
   │   │  (NestJS)   │    │              │    │           │   │
   │   │             │────────────────────────▶│           │   │
   │   └─────────────┘    └──────────────┘    └──────────┘   │
   │                                                          │
   │   Volumes: mongo_data, redis_data (persistent)           │
   └─────────────────────────────────────────────────────────┘
```

The application listens on **port 3000 inside the container**, mapped to the host port from the `PORT` env var (defaults to `3000`). The health endpoint is `GET /api/v1/health`.

## What you'll need everywhere

- Docker Engine ≥ 24 with the Compose plugin.
- A `.env.production` filled in with real secrets (JWT secrets ≥ 32 chars, Redis password, SMTP credentials, the right `CORS_ORIGINS`).
- A way to reach the host on ports 80/443 (or 3000 while you're smoke-testing).
- Optionally: a DNS name and a TLS cert (Let's Encrypt is enough — see each platform's reverse-proxy section).

## What you don't need

- A managed Mongo or Redis. The project ships a working compose stack — you can move to managed services later if you outgrow a single box. Each cloud page calls out where managed services fit in.
- A separate worker pod. The mail queue (BullMQ) runs in the same process by default; flip `MAIL_QUEUE_ENABLED=true` to enable the queue, and you can scale a dedicated worker later without code changes.
- A migration tool. Mongoose creates collections and indexes on first use. The seeder (`npm run seed`) is idempotent.

## Stuck?

Every page has a Troubleshooting section at the bottom. The most common failures are:

1. **App listens on `localhost` instead of `0.0.0.0`** — the project's `main.ts` already binds correctly; you only hit this if you've forked and changed it.
2. **JWT secret validation fails at boot** — both secrets must be ≥32 characters. Regenerate with `openssl rand -base64 64`.
3. **Cloud firewall is blocking the port** — works from `localhost` on the host, times out from your laptop. Re-check the cloud dashboard's security group / firewall rules.
4. **`CORS_ORIGINS` doesn't include the frontend** — browser console shows a CORS error. Add the exact origin (no trailing slash) and restart.
