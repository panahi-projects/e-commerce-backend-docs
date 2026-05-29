# Windows Server / Docker Desktop

You can run the stack on Windows. There are three reasonable paths, and the one you pick depends on whether you're hosting a real production load or running the app locally for development / demo.

| Path                                        | Use case                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **A — Docker Desktop + WSL2** (recommended) | Day-to-day development on Windows 10/11. The whole stack runs in a Linux VM that Docker Desktop manages.     |
| **B — Docker Desktop on Windows Server**    | Small production deployments where your team only operates Windows hosts. Same WSL2 backend.                 |
| **C — Direct Windows containers**           | Niche. Mongo + Redis don't have first-class Windows images; you'd run them via WSL2 anyway. Not recommended. |

This page covers A and B. They're the same stack — only the host OS differs.

> [!TIP]
> Read [Prerequisites](./prerequisites) for the shared steps (env vars, JWT secrets, npm scripts). The differences below are about the **shell**, the **host networking**, and the **file paths**.

## 1. Enable WSL2 and install a Linux distro

WSL2 is the foundation of Docker Desktop on Windows. Enabling it once is enough.

### On Windows 10 / 11

```powershell
# As Administrator
wsl --install
# Reboot when prompted.

# After reboot — pick a distro (default is Ubuntu)
wsl --install -d Ubuntu-22.04
```

### On Windows Server 2022 / 2025

```powershell
# As Administrator
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
# Reboot

# Install the WSL2 kernel update (download from https://aka.ms/wsl2kernel)
wsl --set-default-version 2
wsl --install -d Ubuntu-22.04
```

Once `wsl --list` shows `Ubuntu-22.04 (Default)`, you're ready.

## 2. Install Docker Desktop

Download from <https://www.docker.com/products/docker-desktop> and install. During setup:

- Enable the **"Use WSL 2 instead of Hyper-V"** option.
- After install: Docker Desktop → Settings → Resources → WSL Integration → enable for Ubuntu-22.04.

> [!NOTE]
> On Windows Server, Docker Desktop has a commercial license requirement for organisations over 250 employees or $10M+ revenue. For larger orgs, install Docker Engine directly via the [official Server docs](https://docs.docker.com/engine/install/binaries/) or [Mirantis Container Runtime](https://docs.mirantis.com/mcr/) instead.

Sanity check from a PowerShell prompt:

```powershell
docker --version
docker compose version
```

## 3. Clone the repo inside WSL (recommended)

You can clone the repo either in Windows (`C:\Users\you\…`) or inside WSL (`/home/you/…`). **Cloning inside WSL is much faster** because Docker Desktop's file-system bridge between Windows and the Linux VM has significant overhead.

Open the Ubuntu WSL shell (Start menu → Ubuntu, or `wsl` from PowerShell), then:

```bash
cd ~
git clone https://github.com/<org>/<repo>.git ecommerce
cd ecommerce
git checkout main
```

If your repo is on a Windows path you've already cloned, you can access it from WSL at `/mnt/c/Users/you/path/to/ecommerce` — but expect build times 3–5× longer.

## 4. Create `.env.production`

Inside the WSL shell (same instructions as [Prerequisites § 4](./prerequisites#4-create-env-production)):

```bash
nano .env.production
chmod 600 .env.production
```

Generate JWT secrets:

```bash
openssl rand -base64 64
```

If `openssl` isn't installed in your WSL distro: `sudo apt install -y openssl`. Or use the Node binary that comes with Docker images: `docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

> [!WARNING]
> Don't edit `.env.production` in Notepad / VS Code on the Windows side and save it back into WSL — Windows line endings (`CRLF`) sometimes confuse the Joi schema validator. Edit via `nano`, `vim`, or VS Code with the **WSL: Open Folder** command (which works inside the Linux file system).

## 5. Build and start

```bash
npm run docker:prod:build
npm run docker:prod:up
```

Or the explicit form:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Wait ~60 seconds, then:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost:3000/api/v1/health
```

## 6. Networking on Windows

Docker Desktop's WSL2 backend exposes container ports on **Windows's `localhost`** automatically — so `curl http://localhost:3000/api/v1/health` works from PowerShell too.

For **inbound access from other machines** (this is the production case), open the Windows Defender Firewall:

```powershell
# As Administrator — allow inbound TCP 3000 (smoke test) and 80/443 (after proxy is up)
New-NetFirewallRule -DisplayName "ecommerce-app-3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000
New-NetFirewallRule -DisplayName "http"              -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80
New-NetFirewallRule -DisplayName "https"             -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443
```

If the box is behind a hardware firewall or a corporate network, you'll need port-forwarding there too. None of this is Docker's problem — it's standard Windows networking.

## 7. (Recommended) HTTPS via IIS or Caddy

Two pragmatic options on Windows:

### Path A — Containerized Caddy

Same as the [Docker Compose page → Caddy section](./docker-compose#containerized-caddy). Lives entirely inside Docker, no Windows-side proxy to configure.

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
```

```caddyfile
api.yourdomain.com {
  reverse_proxy app:3000
}
```

### Path B — IIS as the reverse proxy (Windows Server)

If your ops team is already operating IIS:

1. Install the **URL Rewrite** and **Application Request Routing (ARR)** modules.
2. Bind your site to `:443` with a real cert (Let's Encrypt via win-acme works well, or a paid cert).
3. In the URL Rewrite rules, add an inbound rule that forwards `/*` to `http://localhost:3000/{R:0}` and copies the `Host` / `X-Forwarded-*` headers.

ARR's "Preserve Host Header" must be ON for the NestJS app's CORS handling to see the right `Host`.

## 8. Auto-start

For Docker Desktop to bring the stack up after a reboot, in Docker Desktop → Settings → General, enable:

- ✓ **Start Docker Desktop when you sign in to your computer.**
- ✓ **Use the WSL 2 based engine.**

For Windows Server where no user is logged in interactively, run Docker Desktop as a Windows service via [docker-desktop-service](https://docs.docker.com/desktop/setup/install/windows-install/#start-docker-desktop), or install **Docker Engine on Windows** directly without the Desktop GUI (server-only mode).

The compose containers already have `restart: unless-stopped`, so once Docker is up they restart themselves.

## 9. File system performance notes

WSL2 file I/O on the Linux side (`/home/you/…`) is fast. On the Windows side (`/mnt/c/…`) it's slow — this is well known and a hard limit of how WSL2's 9P file-sharing protocol works.

**Practical impact:**

- Keep the repo, the `node_modules`, and the Docker volumes inside WSL2 (the default — no extra work needed if you cloned into `~`).
- If you must edit files from Windows, use the **VS Code WSL extension** — it transparently runs the VS Code server inside the Linux VM and edits files at native Linux speed.
- For very small projects the difference is invisible. For this one (large `node_modules`), the difference is 3–10× build time.

## 10. Day-2 operations

All the standard scripts from [Prerequisites § 9](./prerequisites#9-day-2-npm-scripts) work as-is from the WSL shell. From PowerShell you can run the same commands as long as Docker Desktop is up.

| Task                   | Command                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Tail logs              | `npm run docker:prod:logs`                                                                      |
| Restart only the app   | `npm run docker:prod:restart`                                                                   |
| Open a shell           | `docker exec -it ecommerce_app sh`                                                              |
| Stop the stack         | `npm run docker:prod:down`                                                                      |
| Restart Docker Desktop | Right-click the tray icon → Restart, or `Restart-Service com.docker.service` (PowerShell admin) |

## 11. Troubleshooting

| Problem                                                      | Try this                                                                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `docker` not found in WSL                                    | Docker Desktop → Settings → Resources → WSL Integration → enable for your distro.                               |
| `wsl --install` fails on Windows Server                      | You may need to install the WSL2 kernel update manually: <https://aka.ms/wsl2kernel>.                           |
| Build is very slow (30+ min)                                 | Repo is on `/mnt/c/...`. Move it to the WSL2 file system (`~`) and re-build.                                    |
| `EACCES` / `permission denied` on files mounted from Windows | Same root cause — move to WSL2-native filesystem.                                                               |
| Containers crash with "no space left on device"              | Docker Desktop's WSL2 VM disk has a quota. Settings → Resources → Disk image size: bump to 64+ GB.              |
| `localhost:3000` works in WSL but not PowerShell             | Restart Docker Desktop. WSL ↔ Windows port forwarding occasionally drops; a restart re-establishes it.          |
| `.env.production` has CRLF and Joi rejects it                | `dos2unix .env.production` inside WSL, or re-create the file in a Linux-aware editor.                           |
| Outdated Docker Desktop                                      | Settings → Software updates → Check for updates. Docker Desktop ≥ 4.20 is recommended for stable WSL2 file I/O. |
