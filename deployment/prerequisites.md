# Prerequisites

Shared across every platform. Read this once, then jump to the per-platform page.

## 1. What you need before you start

| Thing                        | Why                                                                    |
| ---------------------------- | ---------------------------------------------------------------------- |
| A host with shell access     | SSH on Linux, RDP/PowerShell on Windows. Root or sudo.                 |
| Docker Engine ≥ 24           | The app and its DBs run as containers.                                 |
| Docker Compose plugin        | Comes bundled with modern Docker installs (`docker compose`, no dash). |
| Git (or the project tarball) | To get the source onto the host. `git clone` is the normal path.       |
| A code editor on the host    | `nano`, `vim`, or VS Code Remote — to fill in `.env.production`.       |
| Outbound HTTPS from the host | To pull Docker images and (optionally) Let's Encrypt certs.            |

**Recommended instance size:** 2 vCPU / 4 GB RAM / 40 GB SSD comfortably runs the app + Mongo + Redis on one box. Smaller works for low traffic.

## 2. Install Docker Engine + Compose plugin

The official one-liner works on every Debian/Ubuntu derivative and most modern Linuxes. On Windows, [install Docker Desktop](./windows-server) instead.

```bash
# Remove old docker packages if any
sudo apt remove -y docker docker-engine docker.io containerd runc || true

# Prerequisites
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release

# Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Docker repo
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let your user run docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Sanity check
docker --version
docker compose version
```

> [!TIP]
> If `docker pull` hangs because of a regional restriction, configure a mirror in `/etc/docker/daemon.json` and restart Docker. The [ArvanCloud guide](./arvancloud#docker-pull-from-iran) shows the recipe — it works for any regional mirror.

## 3. Get the source onto the host

```bash
cd /opt
sudo mkdir -p ecommerce && sudo chown $USER:$USER ecommerce
cd ecommerce
git clone https://github.com/<org>/<repo>.git .
git checkout main
```

For a private repo, register a **deploy key** (read-only SSH key) on the GitHub side and clone via `git@github.com:org/repo.git`.

## 4. Create `.env.production`

`.env.production` is gitignored — it lives only on the host and holds the real secrets. The repo ships a template at the root (also called `.env.production` and committed as an example with placeholder values). Open it and replace the placeholders:

```bash
cd /opt/ecommerce
nano .env.production
chmod 600 .env.production
```

### Required changes

| Key                  | What to put                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `REDIS_PASSWORD`     | A strong random password.                                                                                   |
| `JWT_ACCESS_SECRET`  | At least 32 chars. Generate with `openssl rand -base64 64`.                                                 |
| `JWT_REFRESH_SECRET` | At least 32 chars. **Different** from `JWT_ACCESS_SECRET`. Generate with another `openssl rand -base64 64`. |
| `CORS_ORIGINS`       | Your real frontend origin(s), comma-separated, **no trailing slash**.                                       |
| `MAIL_*`             | Real SMTP credentials. If you don't have any yet, leave them empty — mail will just no-op.                  |

### Optional changes

| Key                               | Default                                | When to change                                                                       |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| `PORT`                            | `3000`                                 | If your reverse proxy expects a different host port.                                 |
| `MONGODB_DB_NAME`                 | `ecommerce_mvp`                        | Per-environment naming (e.g. `ecommerce_staging`).                                   |
| `ENABLED_PLUGINS`                 | All eight plugins                      | Strip plugins this deployment doesn't ship to its tenants.                           |
| `FEATURE_FLAGS_CACHE_TTL_SECONDS` | `300`                                  | Lower it (60) for faster flag propagation, higher (600) for fewer Mongo round-trips. |
| `SWAGGER_ENABLED`                 | `false` (in `docker-compose.prod.yml`) | Set `true` in non-public deployments where Swagger UI is useful.                     |
| `LOG_LEVEL`                       | `info`                                 | `debug` while investigating something; `warn` in high-volume production.             |

### Generate JWT secrets

```bash
# Run twice — once per secret
openssl rand -base64 64
```

If `openssl` isn't installed, `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` does the same thing using the Node binary that's already on the host.

## 5. Build the production image

```bash
cd /opt/ecommerce
docker compose -f docker-compose.prod.yml --env-file .env.production build

# or, equivalently:
npm run docker:prod:build
```

First build takes **3–10 minutes** on a 2-vCPU host because `npm ci` runs twice (build stage + runtime stage in the multi-stage Dockerfile). Subsequent builds reuse layers and finish in well under a minute when nothing in `package*.json` has changed.

## 6. Bring the stack up

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# or:
npm run docker:prod:up
```

You should see three containers come up in roughly this order: Mongo and Redis first (they have their own health checks), then the app once `depends_on: service_healthy` is satisfied. Allow ~60 seconds for everything to settle.

## 7. Verify

```bash
docker compose -f docker-compose.prod.yml ps
# All three should show "Up (healthy)"

# From the host:
curl http://localhost:3000/api/v1/health
# Expected: { "status": "ok", ... }
```

If that returns `200 OK` but your laptop can't reach the same URL via the public IP, the problem is the **cloud firewall**, not the app. Re-check your platform's firewall page.

## 8. (Optional) Seed mock data

```bash
docker exec -it ecommerce_app sh
# inside the container:
npm run seed
exit
```

The seeder is idempotent — safe to run repeatedly. Useful for staging environments and first-deploy smoke tests. Skip on production unless you actively want the seed users (`alice@admin.com` / `Test@1234`, etc.).

## 9. Day-2 npm scripts

The project ships these for convenience — they all wrap the equivalent `docker compose -f docker-compose.prod.yml --env-file .env.production …` command, so use whichever feels more natural.

| Script                        | What it does                                      |
| ----------------------------- | ------------------------------------------------- |
| `npm run docker:prod:build`   | Build the production image (no cache).            |
| `npm run docker:prod:up`      | Start app + mongo + redis in detached mode.       |
| `npm run docker:prod:down`    | Stop and remove the containers (volumes survive). |
| `npm run docker:prod:logs`    | Follow logs from all three services.              |
| `npm run docker:prod:restart` | Restart only the `app` container.                 |
| `npm run docker:prod:ps`      | Show container status.                            |

## 10. Backup the database

```bash
# Snapshot from inside the mongo container
docker exec ecommerce_mongo mongodump --db ecommerce_mvp --archive=/tmp/dump.gz --gzip
docker cp ecommerce_mongo:/tmp/dump.gz ./mongo-$(date +%F).archive.gz
```

Copy the resulting archive off the box — to your laptop with `scp`, to S3 with `aws s3 cp`, or to whatever object store your cloud offers.

## 11. Update to a new commit

```bash
cd /opt/ecommerce
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

`up -d` recreates only the containers whose image changed — Mongo and Redis keep running and their volumes are untouched. Total downtime is typically a few seconds while the app container is replaced.

## 12. Common troubleshooting

| Problem                                          | Try this                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `npm ci` fails inside Docker with engine warning | Confirm Dockerfile is `node:22-alpine`, not `node:20-alpine`.             |
| App container restarts in a loop                 | `docker logs ecommerce_app` — usually a missing env var.                  |
| `JWT_ACCESS_SECRET` validation error             | Both JWT secrets must be ≥32 chars in `.env.production`.                  |
| `ECONNREFUSED 127.0.0.1:6379`                    | App is reading `localhost` instead of `redis` — env not loaded.           |
| `Authentication required` from Redis             | `REDIS_PASSWORD` in `.env.production` differs from the running container. |
| Public IP times out, localhost works             | Cloud firewall — open 3000 (or 80/443 once Nginx is in).                  |
| `docker pull` hangs                              | Configure a regional registry mirror in `/etc/docker/daemon.json`.        |
| Build runs out of disk                           | `docker system prune -af --volumes` (⚠️ wipes unused volumes too).        |
