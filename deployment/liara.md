# Liara (Iran)

This page covers **two ways** to deploy the e-commerce backend on [Liara](https://liara.ir), Iran's PaaS + IaaS cloud platform:

| Method                             | What you get                                                                                                         | When to use                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Method 1 — App Platform (PaaS)** | Liara builds your Docker image, runs it, and gives you a `*.liara.run` subdomain. Managed MongoDB + Redis available. | You want zero server management.                                                        |
| **Method 2 — Cloud Server (IaaS)** | A Linux VPS with full SSH access. You run `docker compose` yourself, exactly like any other server.                  | You want full control, custom networking, or you're already comfortable with Linux ops. |

> [!TIP]
> Read [Prerequisites](./prerequisites) first for the shared steps (env vars, JWT secrets, npm scripts).

## Placeholders

| Placeholder        | What it stands for                               | Example             |
| ------------------ | ------------------------------------------------ | ------------------- |
| `<APP_ID>`         | The unique app identifier you choose on Liara    | `ecommerce-backend` |
| `<MONGO_ID>`       | The identifier of the managed MongoDB database   | `ecommerce-mongo`   |
| `<REDIS_ID>`       | The identifier of the managed Redis database     | `ecommerce-redis`   |
| `<REDIS_PASSWORD>` | Redis password shown in the Liara console        | `aB3x...`           |
| `<SERVER_IP>`      | Public IP of your Liara cloud server (IaaS only) | `185.12.34.56`      |

---

## Method 1 — App Platform (PaaS)

This method uses Liara's **Docker app** platform. You push your Dockerfile; Liara builds and runs it. You provision MongoDB and Redis as managed databases on Liara and connect them over a **private network**.

### 1.1 Install the Liara CLI

```bash
npm i -g @liara/cli

# Verify
liara --version

# Login
liara login
```

### 1.2 Create the managed databases

> [!NOTE]
> Databases are created in a **separate section** of the Liara Console — not on the "Create App" page. Look for **"دیتابیس‌ها"** (Databases) in the Console sidebar, then click **"ایجاد دیتابیس"** (Create Database).

1. **MongoDB** — click Create Database, choose **MongoDB** version 7.x, pick an identifier (`<MONGO_ID>`), select a private network, and pick a plan.
2. **Redis** — click Create Database again, choose **Redis** version 7.x, pick an identifier (`<REDIS_ID>`), select the **same private network**, and pick a plan.

After creation, go to each database's **Connection** (نحوه اتصال) tab and copy the credentials. For internal (private network) access, the hostnames are the identifiers you chose.

> [!IMPORTANT]
> Both databases and the app must be on the **same private network** for internal connectivity.

### 1.3 Create the Docker app

In the Liara Console:

1. Click **Create App**.
2. Set the platform to **Docker**.
3. Enter a unique App ID: `<APP_ID>` (e.g. `ecommerce-backend`).
4. Select the **same private network** as the databases.
5. Choose a plan (RAM / CPU).

Your app gets a free subdomain: `https://<APP_ID>.liara.run`.

### 1.4 The `liara.json` file

The project already ships a `liara.json` at the root:

```json
{
  "app": "ecommerce-backend",
  "platform": "docker",
  "port": 3000,
  "disks": []
}
```

Update the `"app"` value to match your `<APP_ID>` if you chose a different name.

> [!NOTE]
> Liara Docker apps expose **one HTTP port**. The Dockerfile's `EXPOSE` instruction is optional — Liara reads the port from `liara.json` (or from the `--port` CLI flag).

### 1.5 Set environment variables

Go to the app's **Settings > Environment Variables** in the console (or use the CLI). Set these:

```env
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1
BODY_LIMIT=10mb
CORS_ORIGINS=https://<APP_ID>.liara.run

# MongoDB — use the private-network hostname (the database identifier)
MONGODB_URI=mongodb://<MONGO_ID>:27017
MONGODB_DB_NAME=ecommerce_mvp

# Redis — use the private-network hostname
REDIS_HOST=<REDIS_ID>
REDIS_PORT=6379
REDIS_PASSWORD=<REDIS_PASSWORD>

# JWT — generate with: openssl rand -base64 64
JWT_ACCESS_SECRET=<min 32 chars>
JWT_REFRESH_SECRET=<min 32 chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Mail
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your@email.com
MAIL_PASSWORD=your_mail_password
MAIL_FROM=no-reply@example.com
MAIL_QUEUE_ENABLED=true

# Throttle
THROTTLE_TTL=60
THROTTLE_LIMIT=100
THROTTLE_AUTH_TTL=60
THROTTLE_AUTH_LIMIT=10

# Security
BCRYPT_ROUNDS=12

# Plugins
ENABLED_PLUGINS=coupons,reviews,compareProducts,wishlist,marketing,analytics,loyaltyPoints,notifications,auditLogs
FEATURE_FLAGS_CACHE_TTL_SECONDS=300

# Misc
LOG_LEVEL=info
SWAGGER_ENABLED=true
```

> [!TIP]
> Set `SWAGGER_ENABLED=true` to access the Swagger UI at `https://<APP_ID>.liara.run/api/v1/docs`. Set it to `false` if you want to hide the API docs in production.

### 1.6 The Dockerfile and registry mirrors

The Dockerfile uses **build args** so the same file works on both Liara and GitHub Actions CI:

```dockerfile
ARG NODE_IMAGE=docker-mirror.liara.ir/node:22-alpine
ARG NPM_REGISTRY=https://package-mirror.liara.ir/repository/npm/
```

- **`liara deploy`** — uses the defaults (Liara mirrors). Nothing extra needed.
- **GitHub Actions CI** — overrides with standard registries via `build-args` (see `.github/workflows/ci.yml`).

> [!IMPORTANT]
> **No Docker HEALTHCHECK in the Dockerfile.** Liara's platform has its own health-checking mechanism that probes the container's port. Adding a Docker `HEALTHCHECK` instruction causes Liara to report the container as "unhealthy" and fail the deployment — even when the app is running correctly. The app exposes two health endpoints instead:
>
> - `GET /api/v1/health/liveness` — always returns 200 if the process is running (use for basic probes)
> - `GET /api/v1/health` — full readiness check (MongoDB ping + memory heap)

### 1.7 Deploy

From the project root:

```bash
liara deploy
```

The CLI reads `liara.json`, uploads the project, builds the Docker image on Liara's servers, and starts the container. You'll see build logs in the terminal.

> [!TIP]
> **Slow build?** If the build hangs on `npm install`, the Iranian network is throttling connections to `registry.npmjs.org`. The Dockerfile already points npm at Liara's package mirror. Use the Iran build location for faster Docker base image pulls:
>
> ```bash
> liara deploy --build-location iran
> ```

Useful flags:

| Flag                            | Purpose                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `--app <APP_ID>`                | Override the app ID from `liara.json`                              |
| `--port <N>`                    | Override the port from `liara.json`                                |
| `--no-cache`                    | Force a clean Docker build                                         |
| `--detach`                      | Skip streaming logs after deploy                                   |
| `--build-arg KEY=VAL`           | Pass Docker build arguments                                        |
| `--message "v1.2"`              | Attach a message to the deployment                                 |
| `--dockerfile Dockerfile.liara` | Use an alternate Dockerfile                                        |
| `--build-location iran`         | Build on Liara's Iran region (faster pulls for Iranian registries) |
| `--debug`                       | Show detailed logs during upload and build                         |

### 1.8 Verify

```bash
curl https://<APP_ID>.liara.run/api/v1/health
# Expected: {"status":"ok","info":{"mongodb":{"status":"up"},"memory_heap":{"status":"up"}}}

curl https://<APP_ID>.liara.run/api/v1/health/liveness
# Expected: {"success":true,...,"data":{"status":"ok"}}
```

### 1.9 Seed the database

Liara doesn't give you SSH into the container, so run the seeder **from your local machine** against the Liara MongoDB. You can find the public connection URI in the Liara console under your MongoDB database's **Connection** tab.

```bash
# PowerShell
$env:MONGODB_URI = "mongodb://root:PASSWORD@HOST:PORT/admin?authSource=admin"
$env:MONGODB_DB_NAME = "ecommerce_mvp"
$env:JWT_ACCESS_SECRET = "<your-jwt-access-secret>"
$env:JWT_REFRESH_SECRET = "<your-jwt-refresh-secret>"
$env:ENABLED_PLUGINS = "coupons,reviews,compareProducts,wishlist,marketing,analytics,loyaltyPoints,notifications,auditLogs"
npm run seed
```

```bash
# Bash / macOS / Linux
MONGODB_URI="mongodb://root:PASSWORD@HOST:PORT/admin?authSource=admin" \
MONGODB_DB_NAME="ecommerce_mvp" \
JWT_ACCESS_SECRET="<your-jwt-access-secret>" \
JWT_REFRESH_SECRET="<your-jwt-refresh-secret>" \
ENABLED_PLUGINS="coupons,reviews,compareProducts,wishlist,marketing,analytics,loyaltyPoints,notifications,auditLogs" \
npm run seed
```

> [!NOTE]
> The seeder bootstraps the full `AppModule`, so it needs the same required env vars as the app (JWT secrets, enabled plugins, etc.). All seed user passwords are `Test@1234`.

### 1.10 Swagger UI

When `SWAGGER_ENABLED=true` (the default), the Swagger UI is available at:

```
https://<APP_ID>.liara.run/api/v1/docs
```

The OpenAPI JSON spec is at `/api/v1/docs-json` — use it with code generators or Postman imports.

### 1.11 CORS for frontend apps

> [!IMPORTANT]
> When a frontend team deploys their app (admin panel, storefront, etc.), you must add their origin to the `CORS_ORIGINS` environment variable on Liara. Otherwise, the browser will block their API requests.

In the Liara Console, go to **Settings > Environment Variables** and update:

```env
CORS_ORIGINS={base-url},https://admin-panel.liara.run,https://shop.example.com
```

Each origin is the **exact URL** the frontend is served from (scheme + host, no trailing slash, no path). Restart the app after changing.

For local development, common frontend ports are already included in `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:4200,http://localhost:5173,http://localhost:5174,http://localhost:8080
```

### 1.12 Custom domain

1. In the Liara Console, go to your app's **Domains** tab.
2. Add your domain (e.g. `api.example.com`).
3. Point your DNS A/CNAME record to the IP/hostname Liara shows.
4. Liara provisions a free TLS certificate automatically.
5. Update `CORS_ORIGINS` to include the new domain.

### 1.13 Subsequent deploys

```bash
# From the project root, after committing changes:
liara deploy
```

Liara performs **zero-downtime deployment** — the new container starts and passes the health check before the old one is drained.

### 1.14 Troubleshooting (PaaS)

| Symptom                               | Cause                                               | Fix                                                                                                                                |
| ------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `container is unhealthy` after deploy | Docker `HEALTHCHECK` instruction in the Dockerfile  | Remove the `HEALTHCHECK` from the Dockerfile. Liara uses its own port-based health check; a Docker HEALTHCHECK conflicts with it.  |
| Build fails with npm registry errors  | Iranian network blocking `registry.npmjs.org`       | The Dockerfile already uses Liara's npm mirror. Use `--build-location iran` for faster Docker image pulls too.                     |
| App starts but all requests 404       | Wrong `PORT` env var or port mismatch               | Ensure `PORT=3000` matches `liara.json` `"port": 3000`.                                                                            |
| Config validation error at boot       | Missing required env vars                           | Check `liara logs` — the Joi validation error lists exactly which variables are missing (e.g. `MONGODB_URI`, `JWT_ACCESS_SECRET`). |
| `ECONNREFUSED` to MongoDB/Redis       | Not on the same private network                     | Check that the app and both databases share the same private network in the Console.                                               |
| `CORS` errors in the browser          | `CORS_ORIGINS` doesn't include the frontend URL     | Add the exact origin (no trailing slash) and redeploy.                                                                             |
| Container restarts in a loop          | JWT secrets < 32 chars or missing required env vars | Check app logs in the Console; Joi validation prints the exact missing variable.                                                   |
| `liara logs` output is truncated      | Old deployment logs fill the buffer                 | Use `liara logs --since 5m` to see only recent logs, or check the Liara Console's log viewer.                                      |
| Swagger UI shows a blank page         | `SWAGGER_ENABLED=false` or CSP issue                | Set `SWAGGER_ENABLED=true` in env vars. The Helmet CSP config already allows Swagger's inline scripts/styles.                      |
| Bootstrap error not visible in logs   | `main.ts` silently swallowed the error              | The bootstrap function now includes `.catch(console.error)` — check for `Bootstrap failed:` in the logs.                           |

---

## Method 2 — Cloud Server (IaaS)

This method uses Liara's **cloud server** service — a Linux VPS with full root access. You SSH in, install Docker, clone the repo, and run `docker compose` exactly like on any other server.

### 2.1 Provision the server

1. Go to the [Liara Console](https://console.liara.ir) > **Cloud Servers**.
2. Choose **Ubuntu 22.04** or **24.04 LTS**.
3. Optionally select the **Docker** pre-installed image to skip manual installation.
4. Pick a plan, add your SSH key, and create the server.
5. Note the public IP: `<SERVER_IP>`.

### 2.2 SSH in

```bash
ssh root@<SERVER_IP>
```

### 2.3 Install Docker (skip if you chose the Docker image)

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

### 2.4 Clone and configure

```bash
git clone https://github.com/<org>/<repo>.git /opt/ecommerce
cd /opt/ecommerce
git checkout main

# Create the production env file
nano .env.production
chmod 600 .env.production
```

Fill in `.env.production` — see [Prerequisites](./prerequisites) for the full variable reference. On the cloud server, MongoDB and Redis run as containers alongside the app, so use the default compose hostnames:

```env
MONGODB_URI=mongodb://mongo:27017
MONGODB_DB_NAME=ecommerce_mvp
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<choose-a-strong-password>
```

### 2.5 Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 2.6 Verify

```bash
# Wait ~60s for all containers to pass health checks
docker compose -f docker-compose.prod.yml ps

curl http://localhost:3000/api/v1/health
```

### 2.7 Seed (optional)

```bash
# Install Node.js on the server (or run from your local machine with MONGODB_URI pointing to the server)
docker exec -it ecommerce_app node -e "console.log('Container is accessible')"

# Or seed from your local machine (if port 27017 is open):
MONGODB_URI=mongodb://<SERVER_IP>:27017 MONGODB_DB_NAME=ecommerce_mvp npm run seed
```

### 2.8 Reverse proxy + TLS

Set up Nginx as a reverse proxy with Let's Encrypt:

```bash
apt install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/ecommerce <<'EOF'
server {
    listen 80;
    server_name <DOMAIN>;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }
}
EOF

ln -s /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# TLS
certbot --nginx -d <DOMAIN>
```

### 2.9 Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

> [!WARNING]
> Do **not** expose ports 27017 (MongoDB) or 6379 (Redis) to the public internet. They should only be accessible inside the Docker network.

### 2.10 Updates

```bash
cd /opt/ecommerce
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 2.11 Troubleshooting (IaaS)

| Symptom                            | Cause                               | Fix                                                                                                                                                            |
| ---------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker pull` times out            | Registry blocked on Iranian network | Use a Docker Hub mirror: `docs.liara.ir/mirrors/docker` or set `registry-mirrors` in `/etc/docker/daemon.json`                                                 |
| App unreachable from outside       | Firewall blocking the port          | Run `ufw allow 'Nginx Full'` or check the Liara dashboard firewall                                                                                             |
| MongoDB container keeps restarting | Insufficient disk space             | Check `df -h`; extend the disk from the Liara Console                                                                                                          |
| `npm install` fails during Docker build | DNS or registry issues              | The Dockerfile already runs `npm config set registry ${NPM_REGISTRY}` (Liara mirror by default) before `npm install`. Use `--build-location iran` if deploying via Liara CLI, or override the `NPM_REGISTRY` build arg. |

---

## Comparison at a glance

| Concern              | App Platform (PaaS)                           | Cloud Server (IaaS)                         |
| -------------------- | --------------------------------------------- | ------------------------------------------- |
| Server management    | Liara handles it                              | You handle it                               |
| Docker build         | Liara builds it                               | You build it                                |
| Scaling              | Change the plan in Console                    | Vertical: resize the VPS                    |
| MongoDB / Redis      | Managed databases (backups, updates by Liara) | Self-hosted in Docker containers            |
| SSH access           | No                                            | Full root                                   |
| Custom networking    | Private network only                          | Full control (iptables, VPN, etc.)          |
| TLS                  | Automatic on `*.liara.run` + custom domains   | Manual (Let's Encrypt / Certbot)            |
| Cost                 | Per-app + per-database plans                  | Per-server plan                             |
| Zero-downtime deploy | Built-in                                      | Manual (rolling restart or blue-green)      |
| Best for             | Teams that want to ship fast                  | Teams that need full infrastructure control |
