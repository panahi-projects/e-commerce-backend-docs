# AWS EC2

Deploy the stack to an Amazon EC2 instance. Same Linux underneath as the [Generic Ubuntu VPS](./ubuntu-debian-vps) guide — the AWS-specific layer is **Security Groups**, **Elastic IPs**, and (optionally) **managed Mongo/Redis** via Atlas + ElastiCache or an Application Load Balancer for HTTPS.

> [!TIP]
> Read [Prerequisites](./prerequisites) first. This page only covers the AWS specifics.

## 1. Provision the instance

In the AWS console, **EC2 → Launch instance**:

| Field            | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| AMI              | Ubuntu Server 24.04 LTS (or 22.04). Stick with `x86_64` unless you're confident on `arm64`. |
| Instance type    | `t3.medium` (2 vCPU / 4 GB) is comfortable. `t3.small` works for low traffic.               |
| Key pair         | Create or pick an existing one — you'll need the `.pem` file to SSH in.                     |
| Network — VPC    | Default VPC is fine.                                                                        |
| Network — subnet | Any public subnet.                                                                          |
| Auto-assign IP   | Enable. (Or assign an Elastic IP after launch for a stable address.)                        |
| Storage          | 30+ GB gp3. Docker images and logs eat through the default 8 GB quickly.                    |
| Security group   | Create new (next section).                                                                  |

### Security group rules

The Security Group is AWS's network firewall. Open exactly what's needed:

| Type       | Protocol | Port | Source                       | Purpose                                            |
| ---------- | -------- | ---- | ---------------------------- | -------------------------------------------------- |
| SSH        | TCP      | 22   | **Your IP only** (`/32`)     | Remote shell. Never `0.0.0.0/0`.                   |
| HTTP       | TCP      | 80   | `0.0.0.0/0`                  | Reverse proxy (Let's Encrypt + redirect)           |
| HTTPS      | TCP      | 443  | `0.0.0.0/0`                  | Public TLS endpoint                                |
| Custom TCP | TCP      | 3000 | `0.0.0.0/0` (temporary only) | Smoke-test before Nginx is in place. Remove after. |

After launch, **EC2 → Elastic IPs → Allocate** and associate one with the instance if you want the public IP to survive stop/start cycles.

## 2. Connect and bootstrap

```bash
chmod 600 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@<ec2-public-ip>

sudo apt update && sudo apt upgrade -y
```

Then follow [Prerequisites § 2–6](./prerequisites#2-install-docker-engine-compose-plugin) verbatim — Docker install, source checkout, `.env.production`, build, start. There is nothing AWS-specific about those steps.

## 3. Verify

```bash
# From the instance
curl http://localhost:3000/api/v1/health

# From your laptop
curl http://<ec2-public-ip>:3000/api/v1/health
```

If `localhost` works but the public IP times out, the **Security Group** is still blocking. Re-open `3000` in the SG and try again.

## 4. (Recommended) Put HTTPS in front

You have two reasonable paths on AWS. Pick one:

### Path A — Nginx + Let's Encrypt on the instance

Same as the [generic VPS section](./ubuntu-debian-vps#5-recommended-put-nginx-https-in-front). Simple, free, runs on the same box. Good for small deployments.

You'll need an A record for your domain pointing at the EC2 public IP (Route 53, Cloudflare, or your registrar's DNS).

### Path B — Application Load Balancer + ACM

If you already use AWS heavily, terminate TLS at an ALB and proxy plaintext HTTP to the EC2 instance. The ALB handles certificate renewal via ACM (free, auto-rotating).

1. **Request a cert in ACM** for `api.yourdomain.com` in the **same region** as the EC2 instance. ACM uses DNS validation — add the CNAME records ACM shows you.
2. **Create a Target Group**:
   - Target type: `Instances`
   - Protocol/port: `HTTP` / `3000`
   - Health check path: `/api/v1/health`
   - Health check matcher: `200`
   - Register the EC2 instance as a target.
3. **Create an Application Load Balancer**:
   - Scheme: `internet-facing`
   - Listeners: `HTTPS:443` → forward to the Target Group, certificate from ACM.
   - (Optional) `HTTP:80` → redirect to `HTTPS:443`.
   - Security group: allow `80` and `443` from `0.0.0.0/0`.
4. **Update the EC2 Security Group**: change the source for port `3000` from `0.0.0.0/0` to the ALB's Security Group ID (so only the ALB can reach the app — not the public internet directly).
5. **Point DNS at the ALB**: Route 53 alias record, or your DNS provider's CNAME, to the ALB's DNS name.

The app sees the ALB's IP in `X-Forwarded-For` and the scheme in `X-Forwarded-Proto` — both are already trusted by NestJS/Express's default settings.

## 5. Storage decisions

The default `docker-compose.prod.yml` runs Mongo and Redis as containers on the EBS root volume. That's fine for a single-box deployment. When you outgrow it:

- **Mongo → MongoDB Atlas**: easiest. Create a cluster, get the connection string, set `MONGODB_URI=mongodb+srv://…` in `.env.production`, and remove the `mongo` service from the compose file.
- **Mongo → DocumentDB**: AWS-native, billed per ACU-hour, broadly compatible (but check the unsupported operator list). Same swap-the-connection-string change.
- **Redis → ElastiCache**: provision a Redis cluster, set `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`, remove the `redis` service from the compose file. The app's `RedisModule` reads these env vars and connects automatically.

The app code is agnostic — flipping to managed services is purely an env + compose change.

## 6. Backups and snapshots

- **EBS snapshots**: enable Data Lifecycle Manager to take daily EBS snapshots of the root volume. Snapshots are incremental and cheap.
- **App-level Mongo dump** (preferred for migrations): the `mongodump` recipe from [Prerequisites § 10](./prerequisites#10-backup-the-database) works as-is. Push the resulting archive to S3 with `aws s3 cp`.

```bash
# On the instance (after `aws configure`)
docker exec ecommerce_mongo mongodump --db ecommerce_mvp --archive=/tmp/dump.gz --gzip
docker cp ecommerce_mongo:/tmp/dump.gz ./mongo-$(date +%F).archive.gz
aws s3 cp mongo-$(date +%F).archive.gz s3://your-bucket/backups/
```

## 7. Logs and monitoring

The simplest path is `docker compose logs`. If you want centralized logs:

- **CloudWatch Logs**: install the CloudWatch agent and tail Docker's JSON log files at `/var/lib/docker/containers/*/*-json.log`.
- **Or**: switch the app to JSON logs (`LOG_LEVEL=info` already produces structured output) and ship via your tool of choice.

For metrics, EC2's default CloudWatch metrics (CPU, network, disk) cover the host. App-level metrics aren't shipped out of the box — wire them up via OpenTelemetry if you need them.

## 8. Day-2 operations

All the standard scripts from [Prerequisites](./prerequisites#9-day-2-npm-scripts) work. AWS-specific bits:

| Task                   | How                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Resize the instance    | EC2 → Instance state → Stop → Change instance type → Start. (Elastic IP survives.)    |
| Rotate the SSH key     | Add a new public key to `~/.ssh/authorized_keys`, log in via it, remove the old line. |
| Patch the OS           | `sudo apt update && sudo apt upgrade -y && sudo reboot`. Containers auto-restart.     |
| Move to a new instance | Snapshot the EBS root, launch a new instance from it, reassociate the Elastic IP.     |

## 9. Troubleshooting

| Problem                                   | Try this                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `localhost` works, public IP times out    | Security Group on the EC2 instance is blocking the port. Re-check the inbound rules.                                                    |
| ALB target is `unhealthy`                 | Target Group health check is hitting the wrong path. Set it to `/api/v1/health`, matcher `200`.                                         |
| `502 Bad Gateway` from ALB                | Health-check status is OK but app crashed afterwards. `docker compose logs app` on the instance.                                        |
| SSH "permission denied (publickey)"       | `.pem` permissions must be `600`. Also confirm you're using the right username (`ubuntu` for Ubuntu AMIs, `ec2-user` for Amazon Linux). |
| `git pull` fails with "permission denied" | Repo is private and the instance has no deploy key. Add a deploy key on the GitHub repo and clone via `git@github.com:…`.               |
| Build OOM-kills on `t3.micro`             | Either upsize to `t3.small`/`t3.medium`, or add 2 GB of swap (`fallocate /swapfile`).                                                   |
