# DigitalOcean Droplet

Deploy the stack to a DigitalOcean Droplet. Same Linux underneath as the [Generic VPS](./ubuntu-debian-vps) guide — DigitalOcean-specific bits are **Cloud Firewalls**, **floating IPs**, and (optionally) **managed Mongo / Redis** to take the DBs off the Droplet.

> [!TIP]
> Read [Prerequisites](./prerequisites) first. This page only covers the DO specifics.

## 1. Create the Droplet

In the DO console, **Create → Droplets**:

| Field          | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Image          | Ubuntu 24.04 (LTS) x64.                                                                                     |
| Plan           | Basic, Premium AMD or Intel. `2 vCPU / 4 GB` Droplet is comfortable; `1 vCPU / 2 GB` works for low traffic. |
| Region         | Closest to your users. Frankfurt / NYC / Singapore are good defaults.                                       |
| Authentication | **SSH key** (paste your public key). Avoid password auth.                                                   |
| Hostname       | `ecommerce-prod-1` or similar.                                                                              |
| Additional     | Enable **Backups** ($1.20/month per Droplet GB — worth it for production).                                  |
|                | Enable **Monitoring** (free — surfaces CPU/RAM/disk graphs).                                                |

After creation, the Droplet's public IP appears on the detail page. Note it.

## 2. Attach a Cloud Firewall

DigitalOcean's Cloud Firewall lives at the network edge — open it before SSHing in.

In the DO console, **Networking → Firewalls → Create Firewall**:

| Direction | Type             | Protocol | Port range | Sources                |
| --------- | ---------------- | -------- | ---------- | ---------------------- |
| Inbound   | SSH              | TCP      | 22         | **Your IP only**       |
| Inbound   | HTTP             | TCP      | 80         | `All IPv4`, `All IPv6` |
| Inbound   | HTTPS            | TCP      | 443        | `All IPv4`, `All IPv6` |
| Inbound   | Custom           | TCP      | 3000       | `All IPv4` (temporary) |
| Outbound  | All TCP/UDP/ICMP | —        | All        | `All IPv4`, `All IPv6` |

Attach the firewall to the Droplet. Take port `3000` off again after Nginx is in front.

## 3. (Optional) Reserved IP

If you want a stable address that survives Droplet destroys:

**Networking → Reserved IPs → Assign to Droplet** — pick the new Droplet. The reserved IP is free while attached.

## 4. SSH in and bootstrap

```bash
ssh root@<droplet-ip>
adduser deploy
usermod -aG sudo deploy
rsync -a ~/.ssh /home/deploy/ && chown -R deploy:deploy /home/deploy/.ssh
```

Log out, log back in as `deploy`.

Then follow [Prerequisites § 2–6](./prerequisites#2-install-docker-engine-compose-plugin) — Docker install, source checkout, `.env.production`, build, start. No DO-specifics in those steps.

## 5. Verify

```bash
# On the Droplet
curl http://localhost:3000/api/v1/health

# From your laptop
curl http://<droplet-ip>:3000/api/v1/health
```

If `localhost` works but public IP times out: the **DO Cloud Firewall** is blocking `3000`. Go back to step 2 and re-check.

## 6. (Recommended) Domain + HTTPS

Two equally good paths:

### Path A — Nginx + Let's Encrypt on the Droplet

Identical to the [generic VPS section](./ubuntu-debian-vps#5-recommended-put-nginx-https-in-front).

Add an A record `api.yourdomain.com → <droplet-ip>` (or `<reserved-ip>`) in your DNS provider, then `sudo certbot --nginx -d api.yourdomain.com` on the Droplet.

After Nginx is in front, remove port `3000` from the Cloud Firewall.

### Path B — DO Load Balancer

If you plan to run multiple Droplets behind one address:

**Networking → Load Balancers → Create**:

- Region: same as Droplet.
- Forwarding rule: `HTTPS:443` (managed cert) → `HTTP:3000` on the Droplet.
- Health check: `HTTP` on `/api/v1/health` (port `3000`).
- Sticky sessions: off (the app is stateless apart from refresh tokens, which live in Mongo, and Redis-backed feature-flag cache).

DO Load Balancer can issue and renew Let's Encrypt certs for you (managed certificates). Point your DNS at the LB's IP/hostname; remove the EC2-style internet rule for port `3000` and restrict `3000` to the LB's IP range only.

## 7. Storage decisions

The shipped `docker-compose.prod.yml` runs Mongo and Redis on the Droplet. When you outgrow it:

- **Mongo → MongoDB Atlas** (recommended): create a cluster, set `MONGODB_URI=mongodb+srv://…`, remove the `mongo` service from compose. Cross-region peering is straightforward via VPC peering.
- **Mongo → DO Managed MongoDB**: provision under **Databases → Create**, copy the connection string into `.env.production`, remove the `mongo` service.
- **Redis → DO Managed Redis (Valkey)**: same recipe. Set `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` from the DO panel, remove the `redis` service.

DO Managed databases live in the same region and private network as your Droplet — connection latency is single-digit ms.

## 8. Backups

DO's Droplet Backups are weekly snapshots of the entire disk — set-and-forget, $1.20/GB/month. Sufficient for most cases.

For finer-grained, faster restores, also run the `mongodump` recipe from [Prerequisites § 10](./prerequisites#10-backup-the-database) and ship the archive to DO Spaces (S3-compatible):

```bash
docker exec ecommerce_mongo mongodump --db ecommerce_mvp --archive=/tmp/dump.gz --gzip
docker cp ecommerce_mongo:/tmp/dump.gz ./mongo-$(date +%F).archive.gz

# DO Spaces uses S3-compatible credentials
aws --endpoint-url https://<region>.digitaloceanspaces.com \
  s3 cp mongo-$(date +%F).archive.gz s3://your-space/backups/
```

## 9. Day-2 operations

| Task                  | How                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Resize the Droplet    | Power off → **Resize → CPU+RAM** in the panel → Power on. Keeps the same IP if reserved. |
| Rotate the SSH key    | Add to `~/.ssh/authorized_keys`, log in, remove the old line.                            |
| Patch the OS          | `sudo apt update && sudo apt upgrade -y && sudo reboot`. Containers auto-restart.        |
| Move to a new Droplet | Take a snapshot, create a new Droplet from it, reassign the Reserved IP.                 |
| Tail logs             | `npm run docker:prod:logs`.                                                              |
| Restart only the app  | `npm run docker:prod:restart`.                                                           |

## 10. Troubleshooting

| Problem                              | Try this                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Public IP times out, localhost works | DO Cloud Firewall is blocking the port. Confirm the firewall is **attached to the Droplet**.                      |
| Load Balancer target is `unhealthy`  | Health check path/port. Set HTTP `/api/v1/health` on port `3000`.                                                 |
| `apt upgrade` is slow                | DO mirrors can be slow at peak — usually nothing to do; let it finish.                                            |
| Out-of-memory on a 1 GB Droplet      | Add swap (`fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab`). |
| Backup restore Droplet has no IP     | Reserved IPs follow the original; reattach manually after restore.                                                |
