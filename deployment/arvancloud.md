# ArvanCloud (Iran)

This page walks a developer through deploying the NestJS e-commerce backend to an **ArvanCloud IaaS Linux server** (Ubuntu 22.04 or 24.04 LTS) and reaching it on the public IP that ArvanCloud assigned to the instance.

The same steps work on any Iranian cloud provider — the ArvanCloud-specific bits are the **dashboard firewall** and the **registry mirror** notes. The whole [OS prep on an Iranian network](#3-os-prep-on-an-iranian-network) section also applies to any box you provision inside Iran, regardless of vendor.

> [!TIP]
> Read [Prerequisites](./prerequisites) first for the shared steps (env vars, JWT secrets, npm scripts). This page covers everything ArvanCloud-specific **plus** every workaround we've actually had to apply when the Iranian internet is misbehaving — flaky DNS, blocked Docker registries, ISPs filtering port 22, mirrors that resolve from your laptop but not from the datacenter.

## Placeholders used in this guide

Every command below uses placeholders for the values you choose. The **Example** column shows what each placeholder might look like in practice — substitute your own when copy-pasting.

| Placeholder          | What it stands for                                          | Example                              |
| -------------------- | ----------------------------------------------------------- | ------------------------------------ |
| `<SERVER_IP>`        | The public IP ArvanCloud assigned your instance             | `185.12.34.56`                       |
| `<SSH_KEY_NAME>`     | The filename of your SSH private key (no `.pub`)            | `arvan_ecommerce`                    |
| `<SSH_PORT>`         | The port your SSH server listens on (`22` by default)       | `2096` (after moving it per §1.1)    |
| `<SSH_USER>`         | The OS user you SSH as on a fresh ArvanCloud image          | `ubuntu` (or `root`)                 |
| `<WINDOWS_USERNAME>` | Your Windows account name — the folder under `C:\Users\`    | `panahi`                             |
| `<WSL_USER>`         | Your username inside WSL (the home folder under `/home/`)   | usually matches `<WINDOWS_USERNAME>` |
| `<DEPLOY_USER>`      | The non-root sudo user you create on the server (Section 2) | `deploy`                             |
| `<HOSTNAME>`         | The server's own hostname (run `hostname` on it)            | `arvan-ecommerce`                    |
| `<DOMAIN>`           | The DNS name you'll point at the server (Section 10)        | `api.example.com`                    |

> [!NOTE]
> Whenever you change one of these on the server, change it in **every** command you run from then on. The most common copy-paste mistake is leaving `<SSH_PORT>` at `22` after you've moved SSH to a different port — the next `ssh` then times out and you assume the server died.

## Quick deploy (happy-path)

Use this section when **all the one-time setup is already done**:

- Docker + `docker-compose` are installed on the server (§4)
- `/etc/docker/daemon.json` has working registry mirrors + DNS (§4.2)
- Base images (`mongo:7.0`, `redis:7.2-alpine`, `node:22-alpine`) are present (`docker images` lists them — pulled directly or loaded via §4.3)
- `.env.production` is in place at `/opt/ecommerce/.env.production` with real secrets (§6)
- SSH access from your laptop works (§2)
- Optional but recommended: Nginx + HTTPS + a DNS A record pointing `<DOMAIN>` at `<SERVER_IP>` (§10)

If any of those isn't true, follow the full Sections 0–10 first; come back here for every subsequent deploy.

### Step 1 — Push your code from local to GitHub

From the project root on your laptop:

```bash
git status                              # confirm you're on the branch you mean to ship
git add .
git commit -m "feat: describe the change"
git push origin main
```

If you're not using GitHub, jump to [§5 Option B](#option-b--rsync-from-your-laptop) and `rsync` straight to the server instead — the rest of this section still applies.

### Step 2 — SSH into the server

```bash
ssh -i ~/.ssh/<SSH_KEY_NAME> -p <SSH_PORT> <DEPLOY_USER>@<SERVER_IP>
```

If you hit "Connection timed out", flip on a VPN and retry — your ISP filter may have changed. See [§1.1](#11-if-your-isp-filters-outbound-port-22).

### Step 3 — Pull the new commit on the server

```bash
cd /opt/ecommerce
git pull origin main
```

Confirm the new commit is at `HEAD`:

```bash
git log -1 --oneline
```

### Step 4 — Rebuild the app image and restart

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production build app
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Notes:

- Only the `app` service is rebuilt. `mongo` and `redis` keep running with their volumes (`mongo_data`, `redis_data`) untouched — **no data loss**.
- `up -d` recreates only containers whose image changed, so total downtime is a few seconds while the old `ecommerce_app` is swapped out.
- If you also changed `.env.production`, the `app` container needs to be recreated even if the image didn't change. Force it: `docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate app`.

### Step 5 — Wait for the healthcheck to flip

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production ps
```

Re-run until `ecommerce_app` shows `Up (healthy)` — usually within 30–60 seconds. The healthcheck is `GET /api/v1/health`; while it's still "starting" Nginx will return `502`.

Tail the logs in another shell if you want to watch the boot:

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f app
```

Look for `[Bootstrap] Application listening on http://0.0.0.0:3000/api/v1`.

### Step 6 — Verify locally on the server

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","info":{"mongodb":{...},"memory_heap":{...}},...}
```

If this fails, the problem is in the container itself, not the network. Re-check logs.

### Step 7 — Verify globally (from your laptop)

Open a fresh terminal **on your laptop** (so the call really leaves your local box and traverses the public internet):

```bash
# If Nginx + HTTPS is set up (§10) — the production path
curl -i https://<DOMAIN>/api/v1/health

# If you're still exposing port 3000 directly
curl -i http://<SERVER_IP>:3000/api/v1/health
```

Expect `HTTP/1.1 200 OK` and the JSON health payload.

Then spot-check a real endpoint or two:

```bash
curl https://<DOMAIN>/api/v1/products
curl -H "X-Tenant-ID: default" https://<DOMAIN>/api/v1/products
curl https://<DOMAIN>/api/v1/docs            # if SWAGGER_ENABLED=true
```

### Step 8 — Verify globally (from outside Iran)

If you're inside Iran, your `curl` from Step 7 doesn't fully prove the API is reachable to the rest of the world — your route may differ from a foreign client's. Hit it from a non-Iran vantage point:

- **From a web tool** — paste the URL into <https://reqbin.com>, <https://www.webpagetest.org>, or any "curl from another country" service. Pick a region (US/EU) that isn't routed through Iranian infrastructure.
- **From a VPS or CI runner** — if you have a server in another region, `ssh` into it and `curl https://<DOMAIN>/api/v1/health`.
- **From a friend abroad** — ask someone outside Iran to run `curl -i https://<DOMAIN>/api/v1/health` and screenshot the response.
- **GitHub Actions one-shot** — run a workflow that does `curl -i https://<DOMAIN>/api/v1/health` from GitHub's US-based runners; the action log is your proof.

All four should return `HTTP/1.1 200 OK` plus the JSON payload. If they hang or return TLS errors, the issue is at your CDN / Nginx / TLS cert layer, not the app.

### Rollback (if the new deploy broke something)

```bash
cd /opt/ecommerce
git log --oneline -5                                            # find the last good commit
git reset --hard <previous-commit-sha>
docker-compose -f docker-compose.prod.yml --env-file .env.production build app
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Volumes (and therefore the database) are unaffected — only the app container reverts.

### Common failure modes during a quick deploy

| Symptom                                                                 | Cause / fix                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git pull` fails with `Permission denied (publickey)` on a private repo | Your deploy key isn't loaded. `eval $(ssh-agent) && ssh-add ~/.ssh/<SSH_KEY_NAME>`, or use HTTPS + a PAT.                                                                                                                        |
| `docker-compose build app` fails on `npm ci` with a network error       | The build is reaching the public npm registry from inside Iran. Fall back to [§4.3](#43-fallback-ship-images-via-docker-save--scp) — build locally, `docker save`, `scp`, `docker load`.                                         |
| `app` container restarts in a loop after `up -d`                        | Almost always a missing env var. `docker-compose -f docker-compose.prod.yml --env-file .env.production logs app` will show what's missing.                                                                                       |
| Healthcheck stays at `Up (unhealthy)`                                   | App is up but `/api/v1/health` fails — often Mongo or Redis isn't reachable from the container. Check `docker network inspect ecommerce_network`.                                                                                |
| Step 7 from your laptop hangs but Step 6 on the server works            | Either the ArvanCloud firewall closed port 3000 / 80 / 443, or the DNS A record for `<DOMAIN>` isn't pointing at `<SERVER_IP>` yet.                                                                                              |
| Step 8 from outside Iran fails but Step 7 from your laptop works        | Your laptop is going through Iran's routing (so it reaches `<SERVER_IP>` fine), but inbound traffic from abroad is blocked / throttled. Check that the ArvanCloud instance's firewall allows source `any`, not just Iranian IPs. |

## 0. Prerequisites

| Thing                                                 | Where to get it                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| An ArvanCloud account                                 | <https://panel.arvancloud.ir>                                         |
| A running Linux server (Ubuntu 22.04 LTS / 24.04 LTS) | ArvanCloud panel → **Cloud Compute** → **Create Instance**            |
| The public IP of that server                          | Shown in the instance detail page — referenced below as `<SERVER_IP>` |
| The SSH private key                                   | The keypair you selected/uploaded when creating the instance          |
| Git access to this repository                         | Either a deploy key or a personal access token                        |

Recommended instance size: **2 vCPU / 4 GB RAM / 40 GB SSD**. Smaller works for low traffic.

### Generate your SSH key

The ArvanCloud "Create Instance" flow offers three ways to handle SSH:

1. **Auto-generate (OpenSSH)** — ArvanCloud creates the keypair on their side and shows you the private key once. You download it.
2. **Auto-generate (PuTTY)** — Same, but the private key is in `.ppk` format.
3. **Use an existing key** — You paste a public key you generated locally.

**Prefer option 3 — generate manually on your own machine.** That way the private key never touches ArvanCloud's servers, even briefly. For a production server that key is the keys to the kingdom; the extra 30 seconds is worth it.

If you do go with auto-generate, pick **OpenSSH**, not PuTTY:

- OpenSSH format (`id_*`, `*.pem`) is what Windows 11's built-in `ssh.exe`, WSL2, Git Bash, VS Code Remote-SSH, and every `ssh -i …` command in this guide use.
- PuTTY format (`.ppk`) only works with PuTTY's own tools (PuTTY, Pageant, WinSCP-in-PuTTY-mode). It's a legacy choice from before Windows had a native SSH client. You can always convert with `puttygen` later if you need to, but you'll skip the round-trip by starting in OpenSSH.

#### Manual generation — Windows 11 (PowerShell)

```powershell
ssh-keygen -t ed25519 -C "you@example.com" -f $env:USERPROFILE\.ssh\<SSH_KEY_NAME>
```

Hit Enter twice when prompted for a passphrase — or set one for extra protection in case your laptop is stolen (you'll be asked for it on every `ssh`).

Two files are created:

| File                                                  | Purpose                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `C:\Users\<WINDOWS_USERNAME>\.ssh\<SSH_KEY_NAME>`     | **Private key.** Never share, never upload, never paste anywhere except your own `~/.ssh/`. |
| `C:\Users\<WINDOWS_USERNAME>\.ssh\<SSH_KEY_NAME>.pub` | **Public key.** This is the one you paste into ArvanCloud.                                  |

Copy the public key to the clipboard:

```powershell
Get-Content $env:USERPROFILE\.ssh\<SSH_KEY_NAME>.pub | Set-Clipboard
```

In the ArvanCloud "Create Instance" flow, pick **"Use existing key"** (or "Add SSH key") and paste.

#### Manual generation — macOS / Linux

```bash
ssh-keygen -t ed25519 -C "you@example.com" -f ~/.ssh/<SSH_KEY_NAME>

# Copy the public key
cat ~/.ssh/<SSH_KEY_NAME>.pub | pbcopy         # macOS
cat ~/.ssh/<SSH_KEY_NAME>.pub | xclip -sel c   # Linux with xclip
```

#### Why `ed25519` and not `rsa`

`ed25519` is the modern default: shorter keys, faster handshake, and considered more secure than RSA at any practical key size. ArvanCloud accepts it on every recent OS image. Use `-t rsa -b 4096` only if you hit an old SSH server — not the case on a fresh Ubuntu 22.04 / 24.04 instance.

## 1. Open the firewall on ArvanCloud

By default ArvanCloud blocks every inbound port except SSH. Open what you need from the dashboard:

1. ArvanCloud panel → **Cloud Compute** → your instance → **Firewall** tab.
2. Add inbound rules:

   | Protocol | Port | Source        | Why                                |
   | -------- | ---- | ------------- | ---------------------------------- |
   | TCP      | 22   | your IP / any | SSH                                |
   | TCP      | 80   | any           | HTTP (later, for reverse proxy)    |
   | TCP      | 443  | any           | HTTPS (later, for reverse proxy)   |
   | TCP      | 3000 | any           | App port — open while testing only |

> Once you put Nginx in front (Section 10), close 3000 to the public again.

### 1.1 If your ISP filters outbound port 22

The ArvanCloud firewall is only one of two gates. The other is your ISP's outbound filter, and **many residential ISPs in Iran intermittently filter outbound TCP/22**. The symptom: `ssh` hangs for tens of seconds and eventually fails with

```
ssh: connect to host <SERVER_IP> port 22: Connection timed out
```

while the same command works the moment you turn on a VPN. To confirm it's a network drop and not an auth issue:

```bash
ssh -i ~/.ssh/<SSH_KEY_NAME> -o ConnectTimeout=10 <SSH_USER>@<SERVER_IP>
```

If it says **"Connection timed out"** (not "Permission denied"), the packets are being dropped before they reach the server. Three options:

**A. Whitelist your exact IP on port 22.** Find your current public IP at <https://api.ipify.org>, then add a rule on the ArvanCloud firewall: TCP / 22 / `<your-ip>/32`. Only useful if your IP is static — most home ISPs hand out dynamic IPs that rotate after every router reboot.

**B. Move SSH to a port the ISP doesn't filter (recommended).** Ports like `2096`, `8080`, `443`, `80` are almost always open because filtering them would break web browsing. Use **ArvanCloud's built-in web console** (it doesn't go through SSH, so it works even when SSH is blocked) and edit the SSH server config:

```bash
sudo nano /etc/ssh/sshd_config
```

Find the commented `#Port 22` line and replace it with your chosen port — uncomment and change:

```
Port <SSH_PORT>
```

> [!WARNING]
> The file is `sshd_config` (server config), **not** `ssh_config` (client config). They look almost identical, sit next to each other in `/etc/ssh/`, and editing the wrong one does nothing.

Restart SSH:

```bash
sudo systemctl restart ssh
```

> [!TIP]
> On Ubuntu 22.04+ the systemd unit is named `ssh`, not `sshd`. `sudo systemctl restart sshd` returns `Unit sshd.service not found.`

Now open the new port in the ArvanCloud firewall (TCP / port `<SSH_PORT>` / source `any`), then connect from your laptop:

```bash
ssh -i ~/.ssh/<SSH_KEY_NAME> -p <SSH_PORT> <SSH_USER>@<SERVER_IP>
```

If that also times out, your ISP filters `<SSH_PORT>` too — pick another port and repeat. `443` and `80` are the last-resort choices (they're almost never filtered, but they'll later collide with Nginx if you want to run a reverse proxy on the same box).

**C. Always SSH through a VPN.** Simplest fallback, no server-side changes, but requires the VPN to be up every time you touch the box.

## 2. SSH into the server

```bash
# macOS / Linux / WSL2
ssh -i ~/.ssh/<SSH_KEY_NAME> <SSH_USER>@<SERVER_IP>

# Windows 11 PowerShell
ssh -i $env:USERPROFILE\.ssh\<SSH_KEY_NAME> <SSH_USER>@<SERVER_IP>
```

`<SSH_USER>` is typically `ubuntu` on ArvanCloud images; if your instance was created with `root` instead, use that.

Update the OS and create a non-root sudo user if you only have `root`:

```bash
sudo apt update && sudo apt upgrade -y
sudo adduser <DEPLOY_USER>
sudo usermod -aG sudo <DEPLOY_USER>
sudo rsync -a ~/.ssh /home/<DEPLOY_USER>/ && sudo chown -R <DEPLOY_USER>:<DEPLOY_USER> /home/<DEPLOY_USER>/.ssh
```

Then `exit` and log back in as `<DEPLOY_USER>`.

### 2.1 Connecting from WSL — the key-file location quirk

If you're SSH'ing from WSL on a Windows laptop, your private key file probably **does not exist** at the path WSL expects. The symptoms:

```
Warning: Identity file /home/<WSL_USER>/.ssh/<SSH_KEY_NAME> not accessible: No such file or directory.
…
<SSH_USER>@<SERVER_IP>: Permission denied (publickey).
```

WSL has its own Linux filesystem; your Windows files live under `/mnt/c/`. The keypair you created (or downloaded) in Windows is sitting in `C:\Users\<WINDOWS_USERNAME>\.ssh\`, which is **not** the same as `~/.ssh/` inside WSL.

Fix it once:

```bash
# 1. Confirm the key is in the Windows .ssh folder
ls /mnt/c/Users/<WINDOWS_USERNAME>/.ssh/

# 2. Copy the file (just the file — not the whole .ssh directory)
mkdir -p ~/.ssh
cp /mnt/c/Users/<WINDOWS_USERNAME>/.ssh/<SSH_KEY_NAME> ~/.ssh/<SSH_KEY_NAME>

# 3. Lock the permissions or SSH will refuse to use it
chmod 600 ~/.ssh/<SSH_KEY_NAME>
```

Now `ssh -i ~/.ssh/<SSH_KEY_NAME> …` works from WSL.

> [!WARNING]
> `cp /mnt/c/Users/<WINDOWS_USERNAME>/.ssh/` (with a trailing slash and no destination filename) fails with `cp: -r not specified; omitting directory '/mnt/c/Users/<WINDOWS_USERNAME>/.ssh/'`. That's `.ssh` being a directory — copy the **file inside it**, not the directory itself.

### 2.2 Connection works once, then stops working

If you had a working SSH session and the next day it stalls (no prompt, no error, just silence), it's almost certainly **not** the key — it's network filtering kicking in again. Re-read [§1.1](#11-if-your-isp-filters-outbound-port-22) and run the `ConnectTimeout=10` test. The 99% answer is "turn on the VPN" or "switch to the alt port" — the server itself is fine.

## 3. OS prep on an Iranian network

Before you install Docker, the Ubuntu instance needs to be able to reach an APT mirror **and** resolve DNS reliably. On a fresh ArvanCloud instance from inside Iran, that is not guaranteed. Walk this whole section before moving on.

### 3.1 Pick an APT mirror that's actually reachable

Reachability we've seen, in approximate order:

| Mirror                                        | Status from ArvanCloud / Iran                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `http://ir.archive.ubuntu.com/ubuntu`         | ✅ Reliable — the official Ubuntu mirror in Iran. Start here.                                 |
| `http://mirror.arvancloud.ir/ubuntu`          | ⚠️ Often returns "Connecting to mirror.arvancloud.ir" and hangs. Try, but don't depend on it. |
| `https://linux-mirror.liara.ir/repository/…`  | ⚠️ Works from outside Iran better than from inside ArvanCloud's datacenter.                   |
| `http://archive.ubuntu.com/ubuntu` (official) | ❌ Generally unreachable from inside Iran.                                                    |

Take a backup of the current sources file before changing anything:

```bash
sudo cp /etc/apt/sources.list.d/ubuntu.sources /etc/apt/sources.list.d/ubuntu.sources.bak
ls /etc/apt/sources.list.d/         # confirm both files exist
```

> [!NOTE]
> No output from `cp` is good news. On Linux, silence = success — commands only print when something goes wrong.

> [!IMPORTANT]
> Ubuntu **24.04 (Noble)** uses the new **DEB822 format** at `/etc/apt/sources.list.d/ubuntu.sources` — not the old single-line `/etc/apt/sources.list`. Older guides that say `nano /etc/apt/sources.list` are for 22.04 and earlier. On 24.04 that file barely exists; edit `ubuntu.sources` instead.

Edit it:

```bash
sudo nano /etc/apt/sources.list.d/ubuntu.sources
```

Replace the contents with:

```
Types: deb
URIs: http://ir.archive.ubuntu.com/ubuntu
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://ir.archive.ubuntu.com/ubuntu
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
```

Replace `noble` with `jammy` for Ubuntu 22.04. Save with **Ctrl+X → Y → Enter**.

If `nano` refuses to save with `Error writing /etc/apt/sources.list.d/ubuntu.sources: Permission denied`, you forgot the `sudo` — close without saving (Ctrl+X then `N`) and reopen with `sudo nano …`.

Smoke-test the mirror before running `apt update` (to avoid sitting through a 30-second timeout if it's not reachable):

```bash
curl -I http://ir.archive.ubuntu.com/ubuntu
# Expect: HTTP/1.1 301 Moved Permanently   (301 is fine — it just redirects to a trailing slash)
```

If that returns 200/301, you're good:

```bash
sudo apt update
```

If `curl` itself fails with `Could not resolve host`, it's a **DNS** problem, not a mirror problem — jump to §3.2.

### 3.2 Fix DNS resolution

On a healthy box, `cat /etc/resolv.conf` shows `nameserver 127.0.0.53`. That's `systemd-resolved` listening locally. When the system's upstream DNS is unreachable (filtered, slow, blocked), everything that does a hostname lookup hangs — `apt`, `curl`, `docker pull`, the lot.

Iran-friendly DNS servers, in order of likely reachability:

| Servers                              | Source                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `217.218.127.127`, `217.218.155.155` | TIC (Telecommunication Infrastructure Co. of Iran) — published as a fallback during major outages. |
| `178.22.122.100`, `185.51.200.2`     | Shecan — popular public DNS in Iran.                                                               |
| `1.1.1.1`, `8.8.8.8`                 | Cloudflare / Google — work only when not filtered.                                                 |

#### Set the DNS explicitly

`/etc/resolv.conf` is usually a **symlink** managed by systemd-resolved, which is why naive edits get rejected:

```
-bash: /etc/resolv.conf: Permission denied
```

or

```
lsattr: Operation not supported While reading flags on /etc/resolv.conf
```

Inspect what you have:

```bash
ls -la /etc/resolv.conf
# /etc/resolv.conf -> ../run/systemd/resolve/stub-resolv.conf
```

Replace the symlink with a real file you own:

```bash
sudo rm /etc/resolv.conf
sudo tee /etc/resolv.conf << 'EOF'
nameserver 217.218.127.127
nameserver 217.218.155.155
EOF
```

Verify and test:

```bash
cat /etc/resolv.conf
curl -I http://ir.archive.ubuntu.com/ubuntu        # should now succeed
```

To make the change survive reboots (otherwise systemd-resolved will recreate the symlink on next boot):

```bash
sudo systemctl disable systemd-resolved
sudo systemctl stop systemd-resolved
```

#### Restore the default later

If you want to go back to the default systemd-resolved setup:

```bash
sudo rm /etc/resolv.conf
sudo ln -s /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
sudo systemctl enable --now systemd-resolved
resolvectl status                                  # check which DNS the system is using
```

### 3.3 Stop sudo nagging about the hostname

After changing DNS or `/etc/hosts`, you may see:

```
sudo: unable to resolve host <HOSTNAME>: Temporary failure in name resolution
```

It's harmless (the sudo command still runs), but it clutters every output. Fix it by mapping the hostname to `127.0.0.1`:

```bash
echo "127.0.0.1 <HOSTNAME>" | sudo tee -a /etc/hosts
```

> [!WARNING]
> `sudo echo "…" >> /etc/hosts` does **not** work — the shell evaluates the redirect as the current user, not as root, so you get `bash: /etc/hosts: Permission denied`. `sudo tee -a` is the correct pattern (the `-a` flag means **append**).

Replace `<HOSTNAME>` with whatever `hostname` returns on your instance.

### 3.4 What to choose at interactive prompts during `apt upgrade`

`sudo apt upgrade -y` on a freshly-modified box will hit two interactive prompts that `-y` doesn't auto-answer (because they could destroy local changes):

**PAM common-\* files:**

```
One or more of the files /etc/pam.d/common-{auth,account,password,session}
have been locally modified. Please indicate whether these local changes
should be overridden using the system-provided configuration.
…
Override local changes to /etc/pam.d/common-*?
```

→ **Choose "No"**. The PAM files control authentication (SSH logins, sudo, passwords). Overwriting them can lock you out. Your current working config stays.

**sshd_config conflict** (only appears if you changed the SSH port in §1.1):

```
A new version (/tmp/tmp.…) of configuration file /etc/ssh/sshd_config is
available, but the version installed currently has been locally modified.
What do you want to do about modified configuration file sshd_config?

  install the package maintainer's version
  keep the local version currently installed
  show the differences between the versions
  …
```

→ **Choose "keep the local version currently installed"**. The maintainer's version would revert `Port <SSH_PORT>` back to `Port 22` and lock you out (because your ISP filters 22, which is why you moved it).

## 4. Install Docker Engine + Compose

> [!IMPORTANT]
> The official Docker Engine repository at `download.docker.com` is **unreachable from Iran**. The [Prerequisites → Install Docker](./prerequisites#2-install-docker-engine-compose-plugin) recipe (which adds Docker's apt repo) will fail on `curl … docker.com/gpg`. **Use the Ubuntu-shipped packages instead** — they're a bit older than upstream Docker CE, but they install cleanly from `ir.archive.ubuntu.com`.

### 4.1 Install Docker from Ubuntu's repo

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
```

`docker.io` is Ubuntu's package for Docker Engine. `docker-compose` is the **standalone v1 Compose binary** (the one invoked with a hyphen). It's older than the v2 `compose` plugin that ships with Docker CE, but it speaks the same `docker-compose.yml` syntax and runs the project's compose files unchanged.

Verify:

```bash
docker --version           # Docker version 26.x.x or similar
docker-compose --version   # docker-compose version 1.29.x
```

> [!WARNING]
> The Iran-friendly `docker.io` package does **not** include the `docker compose` plugin (no space). Running `docker compose version` returns:
>
> ```
> docker: unknown command: docker compose
> ```
>
> Use **`docker-compose` (with a hyphen)** instead. Every command in the project's npm scripts uses `docker compose` (space) — when running on this server, either substitute the hyphenated form or override the scripts. See §4.4 below.

Add your user to the `docker` group so you don't need `sudo` every time:

```bash
sudo usermod -aG docker $USER
newgrp docker        # re-evaluate group membership without re-logging in
docker info          # should not say "permission denied"
```

### 4.2 Configure registry mirrors (with explicit DNS)

Even with Docker installed, `docker pull` typically fails on Iran with one of these:

```
dial tcp: lookup docker.arvancloud.ir on 127.0.0.53:53: read udp …: i/o timeout
```

```
failed to resolve reference "docker.io/library/hello-world:latest":
docker.io/…: not found
```

The first means Docker can't resolve the mirror domain — even though `curl` from your shell does, because the Docker daemon uses its own DNS path. The second means it reached a mirror that doesn't host the image.

Fix both by writing `/etc/docker/daemon.json` with both `registry-mirrors` **and** explicit `dns`:

```bash
sudo mkdir -p /etc/docker
sudo nano /etc/docker/daemon.json
```

```json
{
  "registry-mirrors": [
    "https://docker.arvancloud.ir",
    "https://registry.docker.ir",
    "https://docker.iranserver.com",
    "https://mirror.iranserver.com/docker"
  ],
  "dns": ["217.218.127.127", "217.218.155.155"]
}
```

Restart Docker and verify the mirrors are loaded:

```bash
sudo systemctl restart docker
docker info | grep -A 5 "Registry Mirrors"
```

Test:

```bash
docker pull hello-world
```

If it sits on `Using default tag: latest` for more than two or three minutes, the mirror is likely unreachable from this box right now — Ctrl+C and probe each mirror manually:

```bash
curl -I https://docker.arvancloud.ir
curl -I https://registry.docker.ir
```

Any `Could not resolve host` answer means DNS is broken again — re-do §3.2. Any `Connection timed out` means the mirror itself is unreachable from ArvanCloud's network and you should fall back to §4.3.

### 4.3 Fallback: ship images via `docker save` + `scp`

When **no** registry mirror is reachable from the server, the most reliable workflow is to pull on a machine that can reach Docker Hub (your laptop, possibly via VPN) and transfer the image as a tarball.

The project's compose stack needs these base images:

| Image              | Why                                                            |
| ------------------ | -------------------------------------------------------------- |
| `mongo:7.0`        | Database                                                       |
| `redis:7.2-alpine` | Cache + feature-flag store                                     |
| `node:22-alpine`   | Pulled implicitly by the multi-stage `Dockerfile` during build |

On your local machine:

```bash
# Pull everything that the server can't reach
docker pull mongo:7.0
docker pull redis:7.2-alpine
docker pull node:22-alpine

# Save each to a tarball
docker save mongo:7.0          -o mongo.tar
docker save redis:7.2-alpine   -o redis.tar
docker save node:22-alpine     -o node-22-alpine.tar

# Transfer to the server (over SSH on whatever port you chose in §1.1)
scp -i ~/.ssh/<SSH_KEY_NAME> -P <SSH_PORT> \
    mongo.tar redis.tar node-22-alpine.tar \
    <SSH_USER>@<SERVER_IP>:~
```

On the server:

```bash
sudo docker load -i ~/mongo.tar
sudo docker load -i ~/redis.tar
sudo docker load -i ~/node-22-alpine.tar
docker images          # confirm they all show up
```

You can now `docker compose -f docker-compose.prod.yml … up -d` without it needing to pull `mongo` or `redis` again, and the `Dockerfile` build can use the local `node:22-alpine`.

If even building the **app image** itself fails on the server (because `npm ci` inside the build stage tries to reach the npm registry), build on your laptop and ship the result:

```bash
# Local
docker compose -f docker-compose.prod.yml build app
docker save ecommerce-backend-app:latest -o app.tar
scp -i ~/.ssh/<SSH_KEY_NAME> -P <SSH_PORT> app.tar <SSH_USER>@<SERVER_IP>:~

# Server
sudo docker load -i ~/app.tar
```

Then change `docker-compose.prod.yml` on the server to reference the loaded image directly instead of `build: .`, or just leave `build:` in place — Docker prefers a present local image.

### 4.4 Use `docker-compose` (with hyphen) for npm scripts on this server

Project npm scripts under `package.json` (`docker:prod:up`, `docker:prod:logs`, etc.) call `docker compose` (with a space — the v2 plugin syntax). On this server you have v1 standalone, so call compose directly:

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production build
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
docker-compose -f docker-compose.prod.yml --env-file .env.production ps
docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f
```

Functionally identical to `docker compose …` for this project.

## 5. Get the source code onto the server

### Option A — git clone (recommended)

```bash
cd /opt
sudo mkdir -p ecommerce && sudo chown $USER:$USER ecommerce
cd ecommerce
git clone https://github.com/<org>/<repo>.git .
git checkout main
```

For a private repo, use a **deploy key** (read-only SSH key registered on the GitHub repo) and clone via `git@github.com:...`.

### Option B — rsync from your laptop

```bash
# from your laptop, in the project root (use -P <port> if you changed SSH port)
rsync -avz --exclude node_modules --exclude dist --exclude .git \
  -e "ssh -i ~/.ssh/<SSH_KEY_NAME> -p <SSH_PORT>" \
  ./ <DEPLOY_USER>@<SERVER_IP>:/opt/ecommerce/
```

You're now in `/opt/ecommerce` on the server.

## 6. Create `.env.production`

`.env.production` is gitignored and contains real secrets — it must live only on the server. Edit and lock it down:

```bash
cd /opt/ecommerce
nano .env.production
chmod 600 .env.production
```

Generate the JWT secrets right there:

```bash
# Run twice — once per secret
openssl rand -base64 64
```

Required changes — see [Prerequisites → Create .env.production](./prerequisites#4-create-env-production) for the full table.

## 7. Build the production image

```bash
cd /opt/ecommerce
docker-compose -f docker-compose.prod.yml --env-file .env.production build
```

First build takes 3–10 minutes on a 2-vCPU box because `npm ci` runs twice (build stage + runtime stage). Subsequent builds use the layer cache.

If `npm ci` inside the build fails with a network error (it'll be reaching the public npm registry), see [§4.3](#43-fallback-ship-images-via-docker-save--scp) — build the image on your laptop and ship it as a tarball.

> [!NOTE]
> If the build fails on `npm ci` with "Exit handler never called!", the base image is too old for the lockfile. The Dockerfile pins `node:22-alpine` — don't downgrade it.

## 8. Bring the stack up

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

The compose file starts three containers and waits for healthchecks:

- `ecommerce_mongo` (Mongo 7.0, persistent volume `mongo_data`)
- `ecommerce_redis` (Redis 7.2, persistent volume `redis_data`, password-protected)
- `ecommerce_app` (your NestJS app on port 3000)

Check status:

```bash
docker-compose -f docker-compose.prod.yml ps
```

You should see `Up (healthy)` next to each container after ~60s. Mongo & Redis become healthy first; the app waits for them via `depends_on: service_healthy`.

Tail the app logs:

```bash
docker-compose -f docker-compose.prod.yml logs -f app
```

Look for:

```
[Bootstrap] Application listening on http://0.0.0.0:3000/api/v1
```

## 9. Verify from your laptop

```bash
curl http://<SERVER_IP>:3000/api/v1/health
# { "status":"ok", "info":{ "mongodb":{...}, "memory_heap":{...} }, ... }

curl http://<SERVER_IP>:3000/api/v1/products
```

If a request hangs or times out:

| Symptom                 | Most common cause                                                 |
| ----------------------- | ----------------------------------------------------------------- |
| `connection refused`    | App container is down (or not bound to `0.0.0.0`)                 |
| `connection timed out`  | ArvanCloud firewall is still blocking 3000 — re-check Section 1   |
| `502`/`504` (via Nginx) | App is up but slow — check `docker-compose logs app`              |
| CORS error in browser   | `CORS_ORIGINS` in `.env.production` doesn't include your frontend |

Re-check the app health from **inside the server** to isolate firewall issues:

```bash
curl http://localhost:3000/api/v1/health
```

If that returns OK but the public IP doesn't, the problem is the ArvanCloud firewall, not the app.

## 10. (Recommended) Put Nginx in front with HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/ecommerce
```

```nginx
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
    proxy_read_timeout 60s;
  }
}
```

Point a DNS A record (`<DOMAIN> → <SERVER_IP>`) at the server, then:

```bash
sudo ln -s /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <DOMAIN>
```

Then close port 3000 on the ArvanCloud firewall — only 80/443 should stay open.

## 11. Day-2 operations

### Open a shell inside a container

```bash
docker exec -it ecommerce_app sh
docker exec -it ecommerce_mongo mongosh ecommerce_mvp
docker exec -it ecommerce_redis redis-cli -a "$REDIS_PASSWORD"
```

### Useful system-state commands on the host

```bash
top         # live process monitor (Q to quit)
free -h     # RAM usage
df -h       # disk space
du -sh *    # size of each folder in current directory
ss -tuln    # open ports and listening services
systemctl status
```

### Pull new code + redeploy

```bash
cd /opt/ecommerce
git pull
docker-compose -f docker-compose.prod.yml --env-file .env.production build
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Full teardown (keeps named volumes — data survives)

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production down
```

### Wipe everything including the database (⚠️ destructive)

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production down -v
```

### Removing files and directories

```bash
rm path/to/file
rm -r path/to/dir          # recursive (folder + contents)
rm -rf path/to/dir         # force, no confirmation
rmdir path/to/empty-dir
```

There is **no recycle bin** on Linux — every `rm` is permanent. Always double-check the path.

## 12. Troubleshooting cheatsheet

| Problem                                                                          | Try this                                                                                                    |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Permission denied` editing `/etc/...`                                           | You forgot `sudo`. Close nano with Ctrl+X then `N`, reopen with `sudo nano …`.                              |
| `nano /etc/apt/sources.list` looks empty on Ubuntu 24.04                         | Wrong file — 24.04 uses **DEB822** at `/etc/apt/sources.list.d/ubuntu.sources`. See §3.1.                   |
| `apt update` hangs on `Ign:1 http://mirror.arvancloud.ir/ubuntu noble InRelease` | The Iranian mirror you picked is unreachable from your instance — switch to `ir.archive.ubuntu.com` (§3.1). |
| `curl: (6) Could not resolve host …`                                             | DNS broken — see §3.2 (set explicit nameservers in `/etc/resolv.conf`).                                     |
| `/etc/resolv.conf: Permission denied` even as root                               | File is a symlink managed by systemd-resolved — `sudo rm` it first, then write the new file. See §3.2.      |
| `lsattr: Operation not supported`                                                | Same as above — it's a symlink, not a real file. Replace the symlink, don't chattr it.                      |
| `-bash: /etc/hosts: Permission denied` after `sudo echo …`                       | `>>` runs as your user, not as root. Use `echo … \| sudo tee -a /etc/hosts`. See §3.3.                      |
| `sudo: unable to resolve host <HOSTNAME>`                                        | Harmless warning — fix by adding `127.0.0.1 <HOSTNAME>` to `/etc/hosts`. See §3.3.                          |
| SSH hangs forever, then "Connection timed out"                                   | ISP is filtering port 22 — turn on a VPN to confirm, then move SSH to a different port. See §1.1.           |
| SSH "Permission denied (publickey)" — from WSL                                   | Key isn't in WSL's `~/.ssh/`. It's still over in `/mnt/c/Users/<WINDOWS_USERNAME>/.ssh/`. See §2.1.         |
| `Unit sshd.service not found.`                                                   | On Ubuntu 22.04+ it's `ssh`, not `sshd`: `sudo systemctl restart ssh`.                                      |
| `docker: unknown command: docker compose`                                        | You installed `docker.io`, not `docker-ce`. Use `docker-compose` (hyphen). See §4.4.                        |
| `apt install -y` shows a TUI dialog about PAM / sshd_config                      | Choose **No** / **keep the local version currently installed**. See §3.4.                                   |
| `docker pull` errors with `dial tcp: lookup … i/o timeout`                       | Docker daemon DNS broken — add `"dns": [...]` to `/etc/docker/daemon.json`. See §4.2.                       |
| `docker.io/library/X: not found` from a mirror                                   | Mirror is reachable but doesn't host that image — try the next mirror, or fall back to save/load (§4.3).    |
| `npm ci` fails inside Docker with engine warning                                 | Confirm Dockerfile is `node:22-alpine`, not `node:20-alpine`.                                               |
| App container restarts in a loop                                                 | `docker logs ecommerce_app` — usually a missing env var.                                                    |
| `JWT_ACCESS_SECRET` validation error                                             | Both JWT secrets must be ≥32 chars in `.env.production`.                                                    |
| `ECONNREFUSED 127.0.0.1:6379`                                                    | App is reading `localhost` instead of `redis` — env not loaded.                                             |
| `Authentication required` from Redis                                             | `REDIS_PASSWORD` in `.env.production` differs from the running container.                                   |
| Public IP times out, localhost works                                             | ArvanCloud firewall — open 3000 (or 80/443 once Nginx is in).                                               |
| Build runs out of disk                                                           | `docker system prune -af --volumes` (⚠️ wipes unused volumes too).                                          |

## TL;DR — first deploy from inside Iran

Assuming Ubuntu 24.04 and you've already created the instance, generated the keypair, and opened ports 22/80/443 in the ArvanCloud firewall:

```bash
ssh -i ~/.ssh/<SSH_KEY_NAME> <SSH_USER>@<SERVER_IP>
# If SSH times out → enable VPN, or change SSH port (§1.1)

# 1. Point APT and DNS at Iran-reachable endpoints
sudo cp /etc/apt/sources.list.d/ubuntu.sources /etc/apt/sources.list.d/ubuntu.sources.bak
sudo nano /etc/apt/sources.list.d/ubuntu.sources        # rewrite per §3.1
sudo rm /etc/resolv.conf
echo -e "nameserver 217.218.127.127\nnameserver 217.218.155.155" | sudo tee /etc/resolv.conf
echo "127.0.0.1 $(hostname)" | sudo tee -a /etc/hosts

# 2. OS update + Docker (the Ubuntu-shipped flavour)
sudo apt update
sudo apt install -y docker.io docker-compose git
sudo usermod -aG docker $USER && newgrp docker

# 3. Docker mirrors + DNS for the daemon
echo '{ "registry-mirrors": ["https://docker.arvancloud.ir","https://registry.docker.ir"], "dns": ["217.218.127.127","217.218.155.155"] }' \
  | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker

# 4. Project source + secrets + run
cd /opt && sudo mkdir ecommerce && sudo chown $USER:$USER ecommerce && cd ecommerce
git clone <repo-url> . && git checkout main
nano .env.production            # fill in real secrets (see Section 6)
chmod 600 .env.production
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d --build
curl http://localhost:3000/api/v1/health
```

From your laptop:

```bash
curl http://<SERVER_IP>:3000/api/v1/health
```

If you see `{"status":"ok",...}` — you're live.
