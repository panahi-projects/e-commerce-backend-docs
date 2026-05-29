# API Reference

The OpenAPI spec is generated at boot by `@nestjs/swagger` and served at:

- **Swagger UI:** `http://localhost:3000/api/v1/docs`
- **OpenAPI JSON:** `http://localhost:3000/api/v1/docs-json`

In the UI, plugin endpoints are prefixed with `[Plugin]` in their tag so they sort separately from core endpoints.

## Endpoint groups

### Core

| Group      | Path prefix                                   | What it does                              |
| ---------- | --------------------------------------------- | ----------------------------------------- |
| Auth       | `/api/v1/auth`                                | Register/login/refresh/OTP/password reset |
| Profile    | `/api/v1/profile`                             | Self-service profile + addresses          |
| Users      | `/api/v1/users`                               | Admin user management                     |
| Categories | `/api/v1/categories`                          | Public tree, admin CRUD                   |
| Products   | `/api/v1/products` / `/api/v1/admin/products` | Public + admin                            |
| Inventory  | `/api/v1/admin/inventory`                     | Stock adjustments + history               |
| Cart       | `/api/v1/cart`                                | Guest-or-user cart                        |
| Checkout   | `/api/v1/checkout`                            | initiate / confirm / cancel               |
| Orders     | `/api/v1/orders`                              | List + status transitions                 |
| Payments   | `/api/v1/payments`                            | Gateway-routed                            |
| Tenants    | `/api/v1/admin/tenants`                       | Tenant + plugin + flag management         |
| Plugins    | `/api/v1/admin/plugins`                       | Deployment plugin registry                |
| Health     | `/health`                                     | Liveness + readiness checks               |

### Plugins (when enabled)

| Plugin           | Path prefix                                       |
| ---------------- | ------------------------------------------------- |
| Coupons          | `/api/v1/coupons`                                 |
| Reviews          | `/api/v1/products/:id/reviews`, `/api/v1/reviews` |
| Compare Products | `/api/v1/compare`                                 |
| Wishlist         | `/api/v1/wishlist`                                |
| Marketing        | `/api/v1/banners`, `/api/v1/newsletter`           |
| Analytics        | `/api/v1/analytics`                               |
| Loyalty Points   | `/api/v1/loyalty`                                 |
| Notifications    | `/api/v1/notifications`                           |

## Auth schemes

| Scheme            | How                                                          |
| ----------------- | ------------------------------------------------------------ |
| `bearer`          | `Authorization: Bearer <access-jwt>` — short-lived (15 min)  |
| `refresh_token`   | httpOnly cookie set by `/auth/login` and `/auth/refresh`     |
| `tenant`          | `X-Tenant-ID: <slug>` header (or subdomain / JWT `tenantId`) |
| `cart_session`    | httpOnly cookie for guest carts                              |
| `compare_session` | httpOnly cookie for the compare-products plugin              |

Swagger's "Authorize" button exposes all of these so you can hit guarded endpoints from the UI.
