# Generic Ubuntu / Debian VPS

Works on any vendor-neutral Ubuntu 22.04 / 24.04 or Debian 12 box — Hetzner Cloud, Linode, OVH, Vultr, Contabo, IONOS, a self-hosted dedicated server, anywhere the provider hands you `ssh root@<ip>` and gets out of the way.

If you're on a cloud with a managed firewall in its dashboard (AWS, DigitalOcean, ArvanCloud), prefer those pages — they cover the dashboard step you can't do over SSH alone.

## 0. Prerequisites

Read [Prerequisites](./prerequisites) first. The steps below cover only what's specific to a generic Linux VPS.

## 1. Pick an instance

| Spec     | Comfortable                            | Bare minimum |
| -------- | -------------------------------------- | ------------ |
| vCPU     | 2                                      | 1            |
| RAM      | 4 GB                                   | 2 GB         |
| Storage  | 40 GB SSD                              | 20 GB SSD    |
| OS image | Ubuntu 22.04 / 24.04 LTS, or Debian 12 | Same         |

Anything below 2 GB RAM will see Mongo + Redis + Node compete for memory and you'll hit OOM kills during the build. If the provider lets you pick "with swap" or set up a swap file post-install, do that.

## 2. SSH in and harden the box

```bash
ssh root@<ip>
# Update everything
apt update && apt upgrade -y

# Create a non-root sudo user (skip if your provider already did)
adduser deploy
usermod -aG sudo deploy
rsync -a ~/.ssh /home/deploy/ && chown -R deploy:deploy /home/deploy/.ssh

# Log out and log back in as deploy
exit
ssh deploy@<ip>
```

### Open the OS-level firewall

`ufw` is the simplest way on Ubuntu/Debian:

```bash
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh           # 22/tcp
sudo ufw allow http          # 80/tcp
sudo ufw allow https         # 443/tcp
sudo ufw allow 3000/tcp      # only while you're smoke-testing — close it after
sudo ufw enable
sudo ufw status
```

> [!WARNING]
> On many cloud providers there's **also** a network-level firewall outside the VM (Security Groups, Cloud Firewall, etc.) that you have to open in the dashboard. `ufw` is only one of the two gates.

## 3. Install Docker + Compose

See [Prerequisites → Install Docker Engine](./prerequisites#2-install-docker-engine-compose-plugin). The official `apt` repository works on every Ubuntu/Debian release.

## 4. Get the source, build, run

```bash
cd /opt
sudo mkdir -p ecommerce && sudo chown $USER:$USER ecommerce
cd ecommerce
git clone https://github.com/<org>/<repo>.git .
git checkout main

nano .env.production        # fill in real secrets — see prerequisites
chmod 600 .env.production

npm run docker:prod:build
npm run docker:prod:up
```

Wait ~60 seconds, then:

```bash
docker compose -f docker-compose.prod.yml ps
# All three: Up (healthy)

curl http://localhost:3000/api/v1/health
# {"status":"ok",...}
```

From your laptop:

```bash
curl http://<vps-ip>:3000/api/v1/health
```

If `localhost` works on the host but the public IP times out, it's the firewall — either `ufw` or the provider's external rules.

## 5. (Recommended) Put Nginx + HTTPS in front

Exposing Node directly on `:3000` is fine for a smoke test. For production, terminate TLS in Nginx and proxy to the app.

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/ecommerce
```

```nginx
server {
  listen 80;
  server_name api.yourdomain.com;

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

Point an A record (`api.yourdomain.com → <vps-ip>`) at the box, then:

```bash
sudo ln -s /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com
```

Certbot rewrites the Nginx config to listen on `443` with a Let's Encrypt cert and adds an HTTP→HTTPS redirect. Renewal runs automatically via systemd timer.

Now close `3000`:

```bash
sudo ufw delete allow 3000/tcp
sudo ufw status
```

…and double-check the cloud-provider dashboard firewall isn't still exposing it.

## 6. Auto-start on boot

Both Docker and the containers' `restart: unless-stopped` policy already handle this — Docker starts on boot via its systemd unit, then each container restarts itself unless you ran `docker stop`. Verify:

```bash
sudo systemctl is-enabled docker      # should print "enabled"
sudo reboot                            # optional; come back in 60s
```

After the reboot, `docker compose -f docker-compose.prod.yml ps` should show the same containers running again.

## 7. Day-2 operations

These work identically on every Linux VPS:

| Task                   | Command                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tail logs              | `npm run docker:prod:logs`                                                                                        |
| Restart just the app   | `npm run docker:prod:restart`                                                                                     |
| Pull new code + deploy | `git pull && npm run docker:prod:build && npm run docker:prod:up`                                                 |
| Backup Mongo           | See [Prerequisites → Backup](./prerequisites#10-backup-the-database).                                             |
| Open a shell           | `docker exec -it ecommerce_app sh` / `ecommerce_mongo mongosh` / `ecommerce_redis redis-cli -a "$REDIS_PASSWORD"` |

## 8. Troubleshooting

| Problem                                | Try this                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `localhost` works, public IP times out | `ufw status` AND the provider's network firewall. One of them is blocking `:3000` (or `:80`/`:443`).                              |
| `502 Bad Gateway` from Nginx           | `npm run docker:prod:logs` — usually the app crashed on boot (missing env var). Fix and re-deploy.                                |
| OOM kill during build                  | Add 2 GB of swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`. |
| Certbot fails with "DNS lookup"        | Wait 5 minutes for the A record to propagate, then re-run.                                                                        |
| Disk fills up                          | `docker system prune -af` (frees ~5–10 GB by removing stopped containers, unused images and build cache).                         |
