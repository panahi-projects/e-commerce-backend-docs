# Docker Compose (any host)

This is the platform-agnostic recipe. It works on any host that runs Docker — a Linux server (any distro, any cloud), a Windows machine via Docker Desktop, a Mac, a NAS that supports Docker, a home-lab box. The host's job is to provide Docker; everything else is identical.

> [!TIP]
> Read [Prerequisites](./prerequisites) for the shared steps (env vars, JWT secrets, npm scripts). This page is the lowest-common-denominator path that strips out every platform-specific detail.

## When to use this page

- You're deploying somewhere this section doesn't have a dedicated page (Hetzner, Linode, OVH, Oracle Cloud, Vultr, Contabo, Scaleway, …).
- You're running the stack on a NAS (Synology, QNAP, TrueNAS) or a home-lab box.
- You're building a CI/CD pipeline and want the canonical "just run docker compose" commands.
- You want to understand the minimum recipe before reading a vendor-specific page.

If you're on one of the platforms we cover specifically, those pages have a few extra useful details (managed Mongo/Redis, vendor firewall quirks, etc.).

## The minimum recipe

```bash
# 1. Have Docker + Compose installed
docker --version          # ≥ 24.x
docker compose version    # plugin, not the old docker-compose binary

# 2. Get the source
git clone https://github.com/<org>/<repo>.git ecommerce
cd ecommerce
git checkout main

# 3. Fill in real secrets
nano .env.production
chmod 600 .env.production    # on Linux/macOS; on Windows the ACLs are different

# 4. Build and start
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# 5. Verify
curl http://localhost:3000/api/v1/health
```

That's the whole story. Everything else on the per-platform pages — firewalls, reverse proxies, DNS, managed databases — is **about the network around the box**, not the stack itself.

## What `docker-compose.prod.yml` actually does

The file already exists at the project root. Quick map of its three services:

| Service                     | Image                   | What it provides                                                             | Volume       |
| --------------------------- | ----------------------- | ---------------------------------------------------------------------------- | ------------ |
| `app` (`ecommerce_app`)     | Built from `Dockerfile` | NestJS server on `:3000`, healthcheck at `/api/v1/health`                    | —            |
| `mongo` (`ecommerce_mongo`) | `mongo:7.0`             | MongoDB with TTL-based replica behaviour disabled, mongosh-based healthcheck | `mongo_data` |
| `redis` (`ecommerce_redis`) | `redis:7.2-alpine`      | Redis with AOF on, password-protected, `maxmemory 256mb` + LRU eviction      | `redis_data` |

All three live on a dedicated `ecommerce_network` bridge. The `app` references `mongo` and `redis` by service name (not `localhost`), so they're only reachable in-network. Host ports `3000`, `27017`, and `6379` are exposed on `0.0.0.0` by default — restrict them at the host firewall.

## Keep the DBs internal-only (recommended)

By default the compose file exposes Mongo on `27017` and Redis on `6379` so you can `mongosh` and `redis-cli` in from the host for debugging. In production, comment those out or bind them to `127.0.0.1` only:

```yaml
services:
  mongo:
    ports:
      - '127.0.0.1:27017:27017' # only the host can reach Mongo
  redis:
    ports:
      - '127.0.0.1:6379:6379' # same for Redis
```

The `app` container still talks to them via the Docker network — it doesn't care about the host ports.

## Reverse proxy patterns

Three common options:

### Inline Nginx (Linux hosts)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Proxy `:80/:443` → `127.0.0.1:3000`. Let's Encrypt for the cert. See the [generic VPS section](./ubuntu-debian-vps#5-recommended-put-nginx-https-in-front) for the full Nginx + Certbot recipe.

### Containerized Caddy

If you want everything in containers (and automatic HTTPS without `certbot`), add a Caddy service:

```yaml
# extension to docker-compose.prod.yml
services:
  caddy:
    image: caddy:2
    container_name: ecommerce_caddy
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - ecommerce_network
    depends_on:
      - app

volumes:
  caddy_data:
  caddy_config:
```

```caddyfile
# ./Caddyfile
api.yourdomain.com {
  reverse_proxy app:3000
}
```

Caddy fetches and renews the Let's Encrypt cert automatically.

### Cloud load balancer (managed TLS)

If your host sits behind a managed LB (Cloudflare, AWS ALB, DO LB), terminate TLS there and let the LB forward plaintext HTTP to `:3000`. The cloud-specific pages cover this in more detail.

## Running on a NAS

The compose file works on Synology DSM 7.2+, QNAP Container Station, TrueNAS SCALE — anywhere with Docker Engine.

NAS-specific gotchas:

- **Mount the bind paths off the NAS share** if you want backups visible in the file manager. Replace the named volumes with a `device:` driver bind to your shared folder.
- **NAS firmware updates may restart Docker**. The `restart: unless-stopped` policy handles that — your stack comes back up on its own.
- **Build on a beefier machine**. NAS CPUs are often ARM or low-power Intel; `npm install` on the build stage can take 15+ minutes. Either pre-build the image elsewhere and `docker save | docker load` it onto the NAS, or push to a registry and `image:` reference it from the compose file.

## Running on a home-lab / dev box

Same recipe works on a desktop running Ubuntu, a Raspberry Pi 5 (use `linux/arm64` — `node:22-alpine` has multi-arch tags), or any old laptop you have lying around. Two extra notes:

- **Mongo on ARM**: `mongo:7.0` does ship `linux/arm64` images. They run fine on Pi 5; the older `arm/v7` (Pi 4 32-bit) is not supported by Mongo 7 — use Mongo 6 there, or move Mongo to a separate `x86_64` box.
- **Dynamic IPs**: if the box's IP changes (no static reservation in your router), use a `*.tailscale.ts.net` address (or similar) instead of the public IP. The app listens on `0.0.0.0` so it's reachable on whatever IP the box currently has.

## Auto-start on host boot

The compose `restart: unless-stopped` policy already covers this — once Docker starts on boot, every container restarts automatically. The only thing you need is for the Docker daemon itself to start on boot:

| OS                    | How                                                                              |
| --------------------- | -------------------------------------------------------------------------------- |
| Ubuntu / Debian       | `sudo systemctl enable docker` (already enabled by default)                      |
| RHEL / Fedora / Rocky | `sudo systemctl enable docker`                                                   |
| Synology / QNAP       | Container Station does this automatically.                                       |
| Docker Desktop (Win)  | Settings → General → ✓ "Start Docker Desktop when you sign in to your computer". |
| Docker Desktop (Mac)  | Same as Windows — Settings → General → Launch on system startup.                 |

After a reboot, run `docker compose -f docker-compose.prod.yml ps` — you should see the same containers running again.

## Sanity-check checklist

When something feels off, walk through this list in order:

1. `docker compose -f docker-compose.prod.yml ps` — all three `Up (healthy)`?
2. `docker compose -f docker-compose.prod.yml logs app | tail -50` — clean startup, no env errors?
3. `curl http://localhost:3000/api/v1/health` from the host — `200`?
4. `curl http://<host-ip>:3000/api/v1/health` from another machine — `200`?
   - If 1–3 pass but 4 times out → **host firewall** (whatever flavour your OS or cloud has).
   - If 1–3 pass but 4 returns `502` → **reverse proxy misconfigured** or app is slow.
5. `docker exec ecommerce_app sh -c 'env | grep MONGO'` — env vars actually loaded?
6. `docker exec ecommerce_mongo mongosh --eval "db.adminCommand('ping')"` — DB reachable from inside?

## Common troubleshooting

| Problem                                                  | Try this                                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker compose` says "no such command"                  | Old Docker; install the Compose plugin (`apt install docker-compose-plugin` on Linux, Docker Desktop 4.x+ on Mac/Win).                                  |
| Containers start but app exits with "Cannot find module" | `dist/` is missing — the build stage failed silently. Rebuild with `--no-cache`.                                                                        |
| Mongo healthcheck never goes green                       | The host has another Mongo on `27017` already; change the host port mapping (`'27018:27017'`) and re-run.                                               |
| Redis healthcheck never goes green                       | `REDIS_PASSWORD` is empty in `.env.production`. The compose `healthcheck` uses `-a "$REDIS_PASSWORD"` which expects a real password.                    |
| Compose recreates volumes every up                       | `docker compose down -v` wipes volumes; use plain `down` to keep data.                                                                                  |
| Images redownload every build                            | `docker buildx prune` was run, or buildx cache is on a tmpfs. Move buildx cache to a persistent directory: `docker buildx create --use --driver-opt …`. |
