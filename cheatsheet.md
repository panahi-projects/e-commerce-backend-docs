# Cheatsheet

Quick reference for everything you need day-to-day. Bookmark this page.

## Commands

| What                     | Command               |
| :----------------------- | :-------------------- |
| Install                  | `npm install`         |
| Dev server               | `npm run start:dev`   |
| Build                    | `npm run build`       |
| Lint                     | `npm run lint`        |
| Tests                    | `npm test`            |
| Coverage                 | `npm run test:cov`    |
| Seed DB                  | `npm run seed`        |
| Infra up (Mongo + Redis) | `npm run infra:start` |
| Infra down               | `npm run infra:stop`  |
| Docs dev server          | `npm run docs:dev`    |
| Docs build               | `npm run docs:build`  |
| Deploy to Liara          | `liara deploy`        |

## URLs (local dev)

| What               | URL                                            |
| :----------------- | :--------------------------------------------- |
| API root           | `http://localhost:3000/api/v1`                 |
| Swagger UI         | `http://localhost:3000/api/v1/docs`            |
| OpenAPI JSON       | `http://localhost:3000/api/v1/docs-json`       |
| Health (readiness) | `http://localhost:3000/api/v1/health`          |
| Health (liveness)  | `http://localhost:3000/api/v1/health/liveness` |

## Request headers

| Header          | Value              | When                  |
| :-------------- | :----------------- | :-------------------- |
| `Content-Type`  | `application/json` | POST / PATCH / PUT    |
| `Authorization` | `Bearer <token>`   | Protected endpoints   |
| `X-Tenant-ID`   | `acme-corp`        | Multi-tenant requests |
| `x-lang`        | `fa` or `en`       | Language override     |

## Response envelope

::: code-group

```json [Success (2xx)]
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "meta": { "page": 1, "limit": 10, "totalDocs": 42 },
  "timestamp": "2026-05-27T12:00:00.000Z"
}
```

```json [Error (4xx/5xx)]
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "must be valid" }],
  "timestamp": "2026-05-27T12:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

:::

## Auth flow

```
POST /auth/register  →  { accessToken }  +  refresh_token cookie
POST /auth/login     →  { accessToken }  +  refresh_token cookie
POST /auth/refresh   →  { accessToken }  (new)  +  rotated cookie
POST /auth/logout    →  cookie cleared
POST /auth/logout-all → all refresh tokens revoked
```

**Access token:** 15 min, stored in memory. **Refresh token:** 7 days, httpOnly cookie.

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

## All endpoints (by module)

### Auth — `/auth`

| Method | Path               | Auth   | Description            |
| :----- | :----------------- | :----- | :--------------------- |
| POST   | `/register`        | Public | Create account         |
| POST   | `/login`           | Public | Get tokens             |
| POST   | `/refresh`         | Cookie | Rotate tokens          |
| POST   | `/logout`          | Bearer | Revoke current refresh |
| POST   | `/logout-all`      | Bearer | Revoke all refreshes   |
| POST   | `/forgot-password` | Public | Send reset email       |
| POST   | `/reset-password`  | Public | Reset with token       |
| POST   | `/change-password` | Bearer | Change own password    |
| POST   | `/otp/send`        | Public | Send OTP               |
| POST   | `/otp/verify`      | Public | Verify OTP             |
| GET    | `/me`              | Bearer | Current user           |

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

| Method | Path            | Auth  | Description         |
| :----- | :-------------- | :---- | :------------------ |
| GET    | `/`             | Admin | List users          |
| GET    | `/:id`          | Admin | Get user            |
| PATCH  | `/:id`          | Admin | Update user         |
| DELETE | `/:id`          | Admin | Soft-delete         |
| PATCH  | `/:id/activate` | Admin | Activate/deactivate |

### Categories — `/categories`

| Method | Path     | Auth   | Description |
| :----- | :------- | :----- | :---------- |
| GET    | `/`      | Public | List        |
| GET    | `/tree`  | Public | Full tree   |
| GET    | `/:slug` | Public | By slug     |
| POST   | `/`      | Admin  | Create      |
| PATCH  | `/:id`   | Admin  | Update      |
| DELETE | `/:id`   | Admin  | Delete      |

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
| DELETE | `/:id`        | Admin  | Delete                     |

### Inventory — `/inventory`

| Method | Path                 | Auth  | Description      |
| :----- | :------------------- | :---- | :--------------- |
| POST   | `/:productId/adjust` | Admin | Adjust stock     |
| GET    | `/alerts/low-stock`  | Admin | Low stock alerts |

### Cart — `/cart`

| Method | Path         | Auth   | Description             |
| :----- | :----------- | :----- | :---------------------- |
| GET    | `/`          | Mixed  | Get cart                |
| POST   | `/items`     | Mixed  | Add item                |
| PATCH  | `/items/:id` | Mixed  | Update quantity         |
| DELETE | `/items/:id` | Mixed  | Remove item             |
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
| GET    | `/:id`        | Mixed  | Order detail  |
| PATCH  | `/:id/status` | Admin  | Update status |
| POST   | `/:id/cancel` | Bearer | Cancel order  |
| POST   | `/:id/refund` | Admin  | Refund order  |

### Payments — `/payments`

| Method | Path            | Auth   | Description      |
| :----- | :-------------- | :----- | :--------------- |
| POST   | `/verify`       | Public | Verify payment   |
| POST   | `/webhook`      | Public | Gateway webhook  |
| POST   | `/refund`       | Admin  | Process refund   |
| GET    | `/transactions` | Admin  | Transaction list |

### Health — `/health`

| Method | Path        | Auth   | Description                |
| :----- | :---------- | :----- | :------------------------- |
| GET    | `/`         | Public | Readiness (Mongo + memory) |
| GET    | `/liveness` | Public | Liveness (always 200)      |

### [Plugin] Coupons — `/coupons`

| Method | Path        | Auth  | Description            |
| :----- | :---------- | :---- | :--------------------- |
| POST   | `/validate` | Mixed | Validate a coupon code |
| GET    | `/`         | Admin | List coupons           |
| POST   | `/`         | Admin | Create                 |
| PATCH  | `/:id`      | Admin | Update                 |
| DELETE | `/:id`      | Admin | Deactivate             |

### [Plugin] Reviews — `/products/:productId/reviews`

| Method | Path            | Auth   | Description           |
| :----- | :-------------- | :----- | :-------------------- |
| GET    | `/`             | Public | List approved reviews |
| POST   | `/`             | Bearer | Submit review         |
| PATCH  | `/:id/moderate` | Admin  | Approve / reject      |
| DELETE | `/:id`          | Admin  | Delete review         |

### [Plugin] Wishlist — `/wishlist`

| Method | Path          | Auth   | Description          |
| :----- | :------------ | :----- | :------------------- |
| GET    | `/`           | Bearer | List wishlist        |
| POST   | `/:productId` | Bearer | Add to wishlist      |
| DELETE | `/:productId` | Bearer | Remove from wishlist |

### [Plugin] Compare — `/compare`

| Method | Path          | Auth  | Description             |
| :----- | :------------ | :---- | :---------------------- |
| GET    | `/`           | Mixed | List compared products  |
| POST   | `/:productId` | Mixed | Add to compare          |
| DELETE | `/:productId` | Mixed | Remove from compare     |
| GET    | `/result`     | Mixed | Side-by-side comparison |

### [Plugin] Marketing — `/banners` + `/newsletter`

| Method | Path                      | Auth   | Description      |
| :----- | :------------------------ | :----- | :--------------- |
| GET    | `/banners`                | Public | Active banners   |
| POST   | `/banners`                | Admin  | Create banner    |
| PATCH  | `/banners/:id`            | Admin  | Update           |
| DELETE | `/banners/:id`            | Admin  | Delete           |
| POST   | `/newsletter/subscribe`   | Public | Subscribe        |
| POST   | `/newsletter/unsubscribe` | Public | Unsubscribe      |
| GET    | `/newsletter/subscribers` | Admin  | List subscribers |

### [Plugin] Analytics — `/analytics`

| Method | Path             | Auth  | Description     |
| :----- | :--------------- | :---- | :-------------- |
| GET    | `/dashboard`     | Admin | Dashboard stats |
| GET    | `/sales`         | Admin | Sales report    |
| GET    | `/products/top`  | Admin | Top products    |
| GET    | `/customers/top` | Admin | Top customers   |

### [Plugin] Loyalty Points — `/loyalty-points`

| Method | Path            | Auth   | Description          |
| :----- | :-------------- | :----- | :------------------- |
| GET    | `/`             | Bearer | My balance + history |
| POST   | `/redeem`       | Bearer | Redeem points        |
| POST   | `/admin/adjust` | Admin  | Admin adjust         |

### Tenants (Admin) — `/admin/tenants`

| Method | Path                              | Auth  | Description    |
| :----- | :-------------------------------- | :---- | :------------- |
| GET    | `/`                               | Admin | List tenants   |
| POST   | `/`                               | Admin | Create tenant  |
| GET    | `/:tenantId`                      | Admin | Get tenant     |
| PATCH  | `/:tenantId`                      | Admin | Update tenant  |
| DELETE | `/:tenantId`                      | Admin | Soft-delete    |
| GET    | `/:tenantId/plugins`              | Admin | Plugin status  |
| PATCH  | `/:tenantId/plugins/:key/enable`  | Admin | Enable plugin  |
| PATCH  | `/:tenantId/plugins/:key/disable` | Admin | Disable plugin |
| PATCH  | `/:tenantId/flags/:plugin`        | Admin | Update flags   |

## Plugin keys

```
coupons, reviews, compareProducts, wishlist,
marketing, analytics, loyaltyPoints, notifications
```

## Environment variables (required)

| Variable             | Example                     |
| :------------------- | :-------------------------- |
| `MONGODB_URI`        | `mongodb://localhost:27017` |
| `MONGODB_DB_NAME`    | `ecommerce_mvp`             |
| `JWT_ACCESS_SECRET`  | `<min 32 chars>`            |
| `JWT_REFRESH_SECRET` | `<min 32 chars>`            |

See `.env.example` for the full list with defaults.

## Commit convention

```
feat(products): add bulk import endpoint
fix(cart): recalculate totals on coupon removal
chore(docker): update node base image
test(auth): add login failure edge cases
docs(deployment): add Liara troubleshooting
```
