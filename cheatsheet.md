# Cheatsheet

Quick reference for everything you need day-to-day. Bookmark this page.

## Commands

| What                     | Command                          |
| :----------------------- | :------------------------------- |
| Install                  | `npm install`                    |
| Dev server               | `npm run start:dev`              |
| Build                    | `npm run build`                  |
| Lint                     | `npm run lint`                   |
| Tests                    | `npm test`                       |
| Coverage                 | `npm run test:cov`               |
| Seed DB                  | `npm run seed`                   |
| Bootstrap super admin    | `npm run cli bootstrap:superadmin` |
| Sync user indexes        | `npm run migrate:user-indexes`   |
| Sync tenant indexes      | `npm run migrate:tenant-indexes` |
| Infra up (Mongo + Redis) | `npm run infra:start`            |
| Infra down               | `npm run infra:stop`             |
| Infra reset (drop data)  | `npm run infra:reset`            |
| Docs dev server          | `npm run docs:dev`               |
| Docs build               | `npm run docs:build`             |
| Deploy to Liara          | `npm run liara:deploy`           |

## URLs (local dev)

| What                  | URL                                            |
| :-------------------- | :--------------------------------------------- |
| API root              | `http://localhost:3000/api/v1`                 |
| Swagger UI            | `http://localhost:3000/api/v1/docs`            |
| OpenAPI JSON          | `http://localhost:3000/api/v1/docs-json`       |
| Scalar API reference  | `http://localhost:3000/api/v1/reference`       |
| Health (readiness)    | `http://localhost:3000/api/v1/health`          |
| Health (liveness)     | `http://localhost:3000/api/v1/health/liveness` |

## Request headers

| Header          | Value              | When                  |
| :-------------- | :----------------- | :-------------------- |
| `Content-Type`  | `application/json` | POST / PATCH / PUT    |
| `Authorization` | `Bearer <token>`   | Protected endpoints   |
| `X-Tenant-ID`   | `acme-corp`        | Multi-tenant requests |
| `x-lang`        | `fa` or `en`       | Language override     |

> The tenant is resolved from (in priority order): subdomain → `X-Tenant-ID`
> header → the `tenantId` claim in the JWT → `default`.

## Response envelope

::: code-group

```json [Success (2xx)]
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": {},
  "meta": { "total": 42, "page": 1, "limit": 10, "totalPages": 5 },
  "timestamp": "2026-06-09T12:00:00.000Z"
}
```

```json [Error (4xx/5xx)]
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "must be valid" }],
  "timestamp": "2026-06-09T12:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

:::

- `message` defaults to `"OK"`; endpoints override it with a translated i18n key.
- `meta` is present only on paginated list responses.
- `errors` is present only for validation / multi-field errors.

## Auth flow (OTP-first)

Accounts are **passwordless by default** — you register with an email or mobile
number and verify with a one-time code. A password is optional and opt-in.

```
POST /auth/register     →  OTP sent over email/SMS  (no tokens yet)
POST /auth/verify-otp   →  { accessToken }  +  refresh_token cookie
POST /auth/request-otp  →  OTP sent (login for an existing account)
POST /auth/login        →  password and/or OTP  →  { accessToken } + cookie
POST /auth/refresh      →  { accessToken } (new)  +  rotated cookie
POST /auth/logout       →  current refresh + access token revoked, cookie cleared
POST /auth/logout-all   →  all refresh tokens revoked (all devices)
POST /auth/set-password →  set first password on an OTP-first account
POST /auth/2fa/toggle   →  on = login needs password AND OTP
```

**Access token:** `1h` (default `15m`), sent in the response body, stored in
memory. **Refresh token:** `7d`, `httpOnly` cookie named `refresh_token`
(rotated on every refresh).

## Seed users

| Email                     | Password    | Role                  |
| :------------------------ | :---------- | :-------------------- |
| `alice@admin.com`         | `Test@1234` | tenant_admin          |
| `bob@staff.com`           | `Test@1234` | tenant_staff          |
| `sara@customer.com`       | `Test@1234` | end_user              |
| `dara@customer.com`       | `Test@1234` | end_user              |
| `unverified@customer.com` | `Test@1234` | end_user (unverified) |

> The `super_admin` is **not** seeded. Create it via `SUPER_ADMIN_EMAIL` /
> `SUPER_ADMIN_PASSWORD` on first boot, or `npm run cli bootstrap:superadmin`.
> All seed users belong to the `default` tenant.

## Role hierarchy

`super_admin` › `tenant_admin` › `tenant_staff` › `end_user`

- **Visibility is hierarchical and tenant-scoped.** When listing or managing
  users, a caller sees only accounts **within their own tenant** whose role is
  **strictly below their own** — a `tenant_admin` sees staff + end-users (not
  peer admins), a `tenant_staff` sees only end-users.
- A non-super-admin can never assign a role at or above their own.
- `super_admin` is platform-wide (`tenantId: null`) and bypasses tenant scope,
  role checks, and feature gates.

## All endpoints (by module)

> **Auth legend** — `Public`: no auth · `Bearer`: JWT required · `Cookie`:
> refresh cookie · `Mixed`: optional auth (user or guest) · `Admin`:
> tenant_admin / tenant_staff · `Super`: super_admin only.

### Auth — `/auth`

| Method | Path              | Auth   | Description                       |
| :----- | :---------------- | :----- | :-------------------------------- |
| POST   | `/register`       | Public | Register (email/mobile) → OTP     |
| POST   | `/request-otp`    | Public | Request login OTP                 |
| POST   | `/verify-otp`     | Public | Verify OTP → tokens               |
| POST   | `/login`          | Public | Login (password and/or OTP)       |
| POST   | `/refresh`        | Cookie | Rotate tokens                     |
| POST   | `/logout`         | Bearer | Revoke current refresh + access   |
| POST   | `/logout-all`     | Bearer | Revoke all refreshes              |
| POST   | `/forgot-password`| Public | Send reset OTP                    |
| POST   | `/reset-password` | Public | Reset with OTP                    |
| POST   | `/change-password`| Bearer | Change own password               |
| POST   | `/set-password`   | Bearer | Set first password (OTP-first)    |
| POST   | `/2fa/toggle`     | Bearer | Toggle two-factor login           |
| POST   | `/otp/send`       | Public | Send email OTP (by purpose)       |
| POST   | `/otp/verify`     | Public | Verify email OTP                  |
| POST   | `/otp/send-sms`   | Public | Send SMS OTP (by purpose)         |
| POST   | `/otp/verify-sms` | Public | Verify SMS OTP                    |
| GET    | `/me`             | Bearer | Current user                      |

### Profile — `/profile`

| Method | Path             | Auth   | Description    |
| :----- | :--------------- | :----- | :------------- |
| GET    | `/`              | Bearer | Get profile    |
| PATCH  | `/`              | Bearer | Update profile |
| GET    | `/addresses`     | Bearer | List addresses |
| POST   | `/addresses`     | Bearer | Add address    |
| PATCH  | `/addresses/:id` | Bearer | Update address |
| DELETE | `/addresses/:id` | Bearer | Remove address |

### Users (Admin) — `/users`

Tenant-scoped + hierarchy-scoped (see [Role hierarchy](#role-hierarchy)).

| Method | Path            | Auth  | Description               |
| :----- | :-------------- | :---- | :------------------------ |
| GET    | `/`             | Admin | List users (scoped)       |
| GET    | `/:id`          | Admin | Get user (scoped)         |
| PATCH  | `/:id`          | Admin | Update user (no escalate) |
| DELETE | `/:id`          | Admin | Soft-delete               |
| PATCH  | `/:id/activate` | Admin | Activate/deactivate       |

### Categories — `/categories`

| Method | Path     | Auth   | Description |
| :----- | :------- | :----- | :---------- |
| GET    | `/`      | Public | List (flat) |
| GET    | `/tree`  | Public | Full tree   |
| GET    | `/:slug` | Public | By slug     |
| POST   | `/`      | Admin  | Create      |
| PATCH  | `/:id`   | Admin  | Update      |
| DELETE | `/:id`   | Admin* | Delete      |

\* DELETE requires `tenant_admin`.

### Products — `/products`

| Method | Path          | Auth   | Description                |
| :----- | :------------ | :----- | :------------------------- |
| GET    | `/`           | Public | Search / filter / paginate |
| GET    | `/featured`   | Public | Featured products          |
| GET    | `/:slug`      | Public | By slug                    |
| GET    | `/admin/list` | Admin  | Admin list (inc. drafts)   |
| POST   | `/`           | Admin  | Create                     |
| PATCH  | `/:id`        | Admin  | Update                     |
| PATCH  | `/:id/status` | Admin  | Change status              |
| DELETE | `/:id`        | Admin* | Delete                     |

\* DELETE requires `tenant_admin`.

### Inventory — `/inventory`

| Method | Path                 | Auth  | Description           |
| :----- | :------------------- | :---- | :-------------------- |
| GET    | `/`                  | Admin | List inventory rows   |
| GET    | `/alerts/low-stock`  | Admin | Low-stock alerts      |
| GET    | `/:productId`        | Admin | Rows for a product    |
| PATCH  | `/:productId/adjust` | Admin | Adjust stock (± delta) |

### Cart — `/cart`

| Method | Path         | Auth   | Description             |
| :----- | :----------- | :----- | :---------------------- |
| GET    | `/`          | Mixed  | Get cart                |
| POST   | `/items`     | Mixed  | Add item                |
| PATCH  | `/items/:id` | Mixed  | Update quantity         |
| DELETE | `/items/:id` | Mixed  | Remove item             |
| DELETE | `/`          | Mixed  | Clear cart              |
| POST   | `/coupon`    | Mixed  | Apply coupon            |
| DELETE | `/coupon`    | Mixed  | Remove coupon           |
| POST   | `/merge`     | Bearer | Merge guest → user cart |

### Checkout — `/checkout`

| Method | Path        | Auth   | Description     |
| :----- | :---------- | :----- | :-------------- |
| POST   | `/initiate` | Bearer | Start checkout  |
| POST   | `/confirm`  | Bearer | Confirm + pay   |
| POST   | `/cancel`   | Bearer | Cancel checkout |

### Orders — `/orders`

| Method | Path          | Auth   | Description   |
| :----- | :------------ | :----- | :------------ |
| GET    | `/`           | Admin  | All orders    |
| GET    | `/my`         | Bearer | My orders     |
| GET    | `/:id`        | Bearer | Order detail  |
| PATCH  | `/:id/status` | Admin  | Update status |
| POST   | `/:id/cancel` | Bearer | Cancel order  |
| POST   | `/:id/refund` | Admin* | Refund order  |

\* refund requires `tenant_admin`.

### Payments — `/payments`

| Method | Path            | Auth   | Description      |
| :----- | :-------------- | :----- | :--------------- |
| POST   | `/verify`       | Public | Verify payment   |
| POST   | `/webhook`      | Public | Gateway webhook  |
| POST   | `/refund`       | Admin* | Process refund   |
| GET    | `/transactions` | Admin  | Transaction list |

\* refund requires `tenant_admin`.

### Permissions (Admin) — `/permissions`

| Method | Path   | Auth   | Description              |
| :----- | :----- | :----- | :----------------------- |
| GET    | `/`    | Admin* | List policy rules        |
| POST   | `/`    | Admin* | Create allow/deny rule   |
| PATCH  | `/:id` | Admin* | Update rule effect       |
| DELETE | `/:id` | Admin* | Delete rule              |

\* requires `tenant_admin`.

### Health — `/health`

| Method | Path        | Auth   | Description                |
| :----- | :---------- | :----- | :------------------------- |
| GET    | `/`         | Public | Readiness (Mongo + memory) |
| GET    | `/liveness` | Public | Liveness (always 200)      |

### [Plugin] Coupons — `/coupons`

| Method | Path             | Auth   | Description              |
| :----- | :--------------- | :----- | :---------------------- |
| POST   | `/validate`      | Public | Validate a coupon code  |
| GET    | `/free-shipping` | Public | Active free-shipping     |
| GET    | `/`              | Admin  | List coupons            |
| POST   | `/`              | Admin* | Create                  |
| PATCH  | `/:id`           | Admin* | Update                  |
| DELETE | `/:id`           | Admin* | Deactivate              |

\* requires `tenant_admin`.

### [Plugin] Reviews — `/products/:productId/reviews` + `/reviews`

| Method | Path                              | Auth   | Description           |
| :----- | :-------------------------------- | :----- | :-------------------- |
| GET    | `/products/:productId/reviews`    | Public | List approved reviews |
| POST   | `/products/:productId/reviews`    | Bearer | Submit review         |
| PATCH  | `/reviews/:id`                    | Admin  | Approve / reject      |
| DELETE | `/reviews/:id`                    | Admin* | Delete review         |

\* delete requires `tenant_admin`.

### [Plugin] Wishlist — `/wishlist`

| Method | Path             | Auth   | Description          |
| :----- | :--------------- | :----- | :------------------- |
| GET    | `/`              | Bearer | List wishlist        |
| POST   | `/share`         | Bearer | Generate share token |
| POST   | `/:productId`    | Bearer | Add to wishlist      |
| DELETE | `/:productId`    | Bearer | Remove from wishlist |
| GET    | `/:userId/public`| Public | View public wishlist |

### [Plugin] Compare — `/compare`

| Method | Path                 | Auth  | Description             |
| :----- | :------------------- | :---- | :---------------------- |
| GET    | `/`                  | Mixed | List compared products  |
| POST   | `/:productId`        | Mixed | Add to compare (max 4)  |
| DELETE | `/:productId`        | Mixed | Remove from compare     |
| DELETE | `/`                  | Mixed | Clear compare list      |
| GET    | `/result`           | Mixed | Side-by-side comparison |
| GET    | `/result/attributes`| Mixed | Attributes-only result  |

### [Plugin] Marketing — `/banners` + `/newsletter`

| Method | Path                      | Auth   | Description      |
| :----- | :------------------------ | :----- | :--------------- |
| GET    | `/banners`                | Public | Active banners   |
| POST   | `/banners`                | Admin  | Create banner    |
| PATCH  | `/banners/:id`            | Admin  | Update           |
| DELETE | `/banners/:id`            | Admin* | Delete           |
| POST   | `/newsletter/subscribe`   | Public | Subscribe        |
| POST   | `/newsletter/unsubscribe` | Public | Unsubscribe      |
| GET    | `/newsletter/subscribers` | Admin  | List subscribers |
| POST   | `/newsletter/sms-broadcast` | Admin* | SMS broadcast  |

\* delete / broadcast require `tenant_admin`.

### [Plugin] Analytics — `/analytics`

| Method | Path                 | Auth   | Description           |
| :----- | :------------------- | :----- | :-------------------- |
| GET    | `/dashboard`         | Admin  | Dashboard counters    |
| GET    | `/sales`             | Admin  | Sales report (by day) |
| GET    | `/products/top`      | Admin  | Top products          |
| GET    | `/customers/top`     | Admin  | Top customers         |
| GET    | `/funnel`            | Admin  | Order funnel          |
| POST   | `/analytics/events`  | Public | Record an event       |
| GET    | `/analytics/events`  | Admin  | List aggregated events |

### [Plugin] Loyalty Points — `/loyalty`

| Method | Path               | Auth   | Description          |
| :----- | :----------------- | :----- | :------------------- |
| GET    | `/balance`         | Bearer | My points balance    |
| GET    | `/transactions`    | Bearer | My history           |
| POST   | `/redeem`          | Bearer | Redeem points        |
| GET    | `/admin/accounts`  | Admin  | List loyalty accounts |
| POST   | `/admin/adjust`    | Admin  | Adjust balance       |

### [Plugin] Notifications — `/notifications`

| Method | Path          | Auth   | Description             |
| :----- | :------------ | :----- | :---------------------- |
| POST   | `/email`      | Admin  | Send email notification |
| POST   | `/sms`        | Admin  | Send SMS notification   |
| POST   | `/push`       | Admin  | Send push notification  |
| POST   | `/sms/bulk`   | Admin* | Bulk SMS to recipients  |

\* bulk requires `tenant_admin`.

### [Plugin] Audit Logs — `/audit-logs`

| Method | Path  | Auth         | Description                       |
| :----- | :---- | :----------- | :-------------------------------- |
| GET    | `/`   | Bearer+Roles | List security/audit logs (scoped) |

> Visible to `super_admin`, `tenant_admin`, `tenant_staff`. Entries auto-expire
> after `AUDIT_LOG_RETENTION_DAYS` (default 90).

### Tenants (Super Admin) — `/admin/tenants`

| Method | Path                                  | Auth  | Description           |
| :----- | :------------------------------------ | :---- | :-------------------- |
| GET    | `/`                                   | Super | List tenants          |
| POST   | `/`                                   | Super | Create tenant         |
| GET    | `/:tenantId`                          | Super | Get tenant            |
| GET    | `/:tenantId/effective`                | Super | Effective config      |
| PATCH  | `/:tenantId`                          | Super | Update tenant         |
| DELETE | `/:tenantId`                          | Super | Soft-delete           |
| GET    | `/:tenantId/plugins`                  | Super | Plugin status         |
| PATCH  | `/:tenantId/plugins/:key/enable`      | Super | Enable plugin         |
| PATCH  | `/:tenantId/plugins/:key/disable`     | Super | Disable plugin        |
| PATCH  | `/:tenantId/flags/:plugin`            | Super | Update feature flags  |
| POST   | `/:tenantId/provision-admin`          | Super | Provision first admin |

### Platform admin — `/admin/*`

| Method | Path                  | Auth  | Description                |
| :----- | :-------------------- | :---- | :------------------------- |
| GET    | `/admin/plugins`      | Super | Plugin registry + status   |
| GET    | `/admin/api-registry` | Admin* | Registered endpoints map  |
| POST   | `/admin/sms/test`     | Super/Admin | Send a test SMS      |

\* api-registry requires `tenant_admin`.

## Plugin keys

Canonical camelCase keys (`src/common/plugins/plugin-keys.ts`):

```
coupons, reviews, compareProducts, wishlist, marketing,
analytics, loyaltyPoints, notifications, auditLogs
```

## Environment variables (required)

| Variable             | Example                     |
| :------------------- | :-------------------------- |
| `MONGODB_URI`        | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME`    | `ecommerce_mvp`             |
| `JWT_ACCESS_SECRET`  | `<min 32 chars>`            |
| `JWT_REFRESH_SECRET` | `<min 32 chars>`            |

Common optional settings:

| Variable               | Default        | Notes                                   |
| :--------------------- | :------------- | :-------------------------------------- |
| `JWT_ACCESS_EXPIRES_IN`| `15m`          | Access token lifetime                   |
| `JWT_REFRESH_EXPIRES_IN`| `7d`          | Refresh token lifetime                  |
| `OTP_LENGTH`           | `6`            | OTP digits                              |
| `OTP_TTL_MINUTES`      | `10`           | OTP validity                            |
| `OTP_MAX_ATTEMPTS`     | `5`            | Verifications before lockout            |
| `OTP_HASHED`           | `true`         | `false` stores raw OTP (testing only)   |
| `SMS_DEFAULT_PROVIDER` | _(auto)_       | `smsir` · `sabanovin` · `melipayamak` · `log` |
| `ENABLED_PLUGINS`      | _(empty)_      | Comma-separated plugin keys to boot     |
| `SUPER_ADMIN_EMAIL`    | —              | First-boot super-admin (with password)  |

See `.env.example` for the full list with defaults.

## Commit convention

```
feat(products): add bulk import endpoint
fix(cart): recalculate totals on coupon removal
chore(docker): update node base image
test(auth): add login failure edge cases
docs(deployment): add Liara troubleshooting
```