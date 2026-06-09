# Auth Flow

Dual-token JWT — short-lived access token + long-lived refresh token in an httpOnly cookie. Both secrets must be at least 32 chars (validated by Joi at boot).

## Registration & login (OTP-first / passwordless)

Registration takes a **single identifier** that is auto-detected as an email or an Iranian mobile number — no name, no password. The account is created passwordless and an OTP is sent over the matching channel; tokens are issued only after the OTP is verified.

| Step | Endpoint | Body | Result |
| ---- | -------- | ---- | ------ |
| Register | `POST /auth/register` | `{ identifier }` | Creates the account, **stores** an OTP, and attempts to send it via email/SMS. Returns `{ identifier, channel, delivery }` — no tokens. `409` if the identifier already exists. |
| Request OTP | `POST /auth/request-otp` | `{ identifier }` | Sends a fresh OTP to an existing account. Returns `data.codeSent: { email, mobile }` - which channel the code went out on (only the channel matching the identifier can be `true`; unknown identifier yields both `false`). |
| Verify (register) | `POST /auth/verify-otp` | `{ identifier, code }` | Consumes the OTP, marks the email/phone verified, **issues tokens**. Completes registration; equivalent to OTP-only login. |
| Set password (first-time) | `POST /auth/set-password` | `{ newPassword }` (authed) | Sets an initial password for an OTP-first account. **First time only** — `409` if a password already exists. |
| Change password | `POST /auth/change-password` | `{ currentPassword, newPassword }` (authed) | Change an existing password (must know the current one). |
| Forgot password | `POST /auth/forgot-password` | `{ identifier }` | Sends a reset OTP to the identifier (email/mobile). Silent if unknown. |
| Reset password | `POST /auth/reset-password` | `{ identifier, code, newPassword }` | Recovery when the current password is forgotten — proves ownership via OTP, sets a new password, revokes sessions. |

### Password lifecycle

Accounts start **passwordless** (OTP-only). The password is optional and follows a strict lifecycle:

1. **set-password** — sets the *first* password (authenticated). Rejected with `409` once a password exists.
2. **change-password** — changes an existing password; must supply the current one.
3. **forgot-password → reset-password** — recovery when the current password is forgotten (identifier + OTP).

`GET /auth/me` returns **`hasPassword: boolean`** so the UI knows whether to offer *set-password* (false → OTP-only) or *change-password* (true). OTP login works regardless of whether a password is set.

### Login methods

`POST /auth/login` is unified — supply an `identifier` (email or mobile, auto-detected) plus **at least one** credential. Which method runs is decided by what you send:

| Method | Body | Notes |
| ------ | ---- | ----- |
| 1 — OTP only | `{ identifier, code }` | Passwordless. Call `request-otp` first. Works for any account. |
| 2 — Password only | `{ identifier, password }` | Classic. Only accounts that set a password; others get `401`. |
| 3 — Password + OTP (2FA) | `{ identifier, password, code }` | Both must pass. |

Sending neither `password` nor `code` returns `400 auth.credentials_required`. A successful login (any method) issues tokens and sets the refresh cookie; an OTP method also marks the channel verified.

> [!IMPORTANT]
> **OTP generation, storage, and delivery are decoupled.** The OTP is generated and stored first; sending it is best-effort. If the SMS/email can't be delivered, registration (and `request-otp`) **still succeed** — the response stays `200` and reports `delivery: { channel, sent: false, detail }`. The stored code is fully usable: read it from the `otps` collection (each row carries the `identifier` it was generated for; set `OTP_HASHED=false` to store the raw code) and complete `verify-otp` manually. Delivery failures no longer return `502` from the auth endpoints.

> [!TIP]
> Outside production the issued OTP is logged to the server console as `[DEV OTP] <PURPOSE> for <identifier>: <code>` so you can copy/paste it during local testing (email also lands in your SMTP inbox, SMS in the configured provider's sandbox/log). You can also set `OTP_HASHED=false` to store the **raw** code in the `otps` collection (instead of the default SHA-256 hash) and read it straight from the DB — OTPs are short-lived and TTL-expired, so this is testing-only; keep `OTP_HASHED=true` in production.

> [!NOTE]
> Profile details (first name, last name, address) are filled later via the profile endpoints. Checkout enforces them — see [Checkout identity gate](#identity-gate).

## Tokens

| Token         | Lifetime | Storage                           | Purpose                                             |
| ------------- | -------- | --------------------------------- | --------------------------------------------------- |
| Access JWT    | 15 min¹  | Client memory (response body)     | Sent on every API call as `Authorization: Bearer …` |
| Refresh token | 7 days²  | httpOnly cookie (`refresh_token`) | Used only to renew the access token                 |

¹ Default; configurable via `JWT_ACCESS_EXPIRES_IN`. &nbsp; ² Configurable via `JWT_REFRESH_EXPIRES_IN`.

## Login sequence

```
client                       /auth/login                MongoDB
  │                              │                          │
  │── POST { email, password } ─▶│                          │
  │                              │── findOne (User) ───────▶│
  │                              │◄───────────  doc ────────│
  │                              │── verify bcrypt          │
  │                              │── sign access JWT        │
  │                              │── create refresh row     │
  │                              │   (hashed token)         │
  │                              │── Set-Cookie refresh    │
  │◄─── body { access, user } ───│                          │
```

The refresh token is stored hashed in `RefreshToken` collection so we can revoke it server-side.

## Logout & access-token revocation

Access tokens are stateless, so logout doesn't just rely on expiry — it actively revokes them via a **Redis denylist** (`TokenRevocationService`):

- Every access token is signed with a unique `jti`.
- `POST /auth/logout` revokes the refresh token **and** denylists the current access token's `jti` (TTL = its remaining lifetime). The very next request with that token gets `401 auth.token_revoked`.
- `POST /auth/logout-all` revokes all refresh tokens **and** sets a per-user cutoff; any access token issued before it is rejected.
- `JwtStrategy` checks the denylist on every authenticated request.

> [!NOTE]
> The revocation check **fails open** if Redis is down (the request is allowed, logged at warn) — consistent with the platform's "never fail a request because the cache is down" rule, and the exposure window is bounded by the short access-token TTL (15 min).

## Refresh sequence

```
client                       /auth/refresh
  │                              │
  │── cookie refresh_token ────▶ │
  │                              │── verify signature
  │                              │── lookup hashed in DB
  │                              │── reject if revoked / expired
  │                              │── sign new access JWT
  │◄─── body { access } ─────────│
```

## Logout

Revokes the refresh row in the DB and clears the cookie.

## Password change

Revokes every refresh token for the user — they need to log in again everywhere.

## OTP

The auth service generates 6-digit codes, stores them hashed with an attempt counter and TTL (`OTP_TTL_MINUTES`, default 10), and delivers them over one of two channels:

| Channel | Send | Verify | Delivery |
| ------- | ---- | ------ | -------- |
| Email   | `POST /auth/otp/send`     | `POST /auth/otp/verify`     | `MailService` |
| SMS     | `POST /auth/otp/send-sms` | `POST /auth/otp/verify-sms` | `SmsService` (multi-provider; default **Sabanovin**, see [SMS](./sms)) |

The SMS endpoints take `{ phone, purpose }` / `{ phone, purpose, code }`. `purpose` is an `OtpPurpose` (`EMAIL_VERIFICATION`, `PHONE_VERIFICATION`, `PASSWORD_RESET`, `LOGIN_2FA`). Verifying a `PHONE_VERIFICATION` OTP sets `User.isPhoneVerified`. Send is silent for unknown phones/emails (never reveals whether an identifier is registered). The same hashed-OTP store and attempt/TTL rules back both channels.

## Identity gate

Because registration collects only an identifier, an account may have no name or address yet. `CheckoutService.initiate` blocks turning a cart into an order until the user has **firstName, lastName, and at least one address** — otherwise it throws `400 checkout.identity_incomplete`. Fill these via the profile endpoints before checkout.

## Roles & tenant binding

The access JWT carries `{ sub, email, role, tenantId }`. Roles are:

| Role           | `tenantId`  | Authority                                                      |
| -------------- | ----------- | -------------------------------------------------------------- |
| `super_admin`  | `null`      | Platform-wide; bypasses tenant scope, roles, and feature gates |
| `tenant_admin` | tenant's id | Administers one tenant (incl. its permission policies)         |
| `tenant_staff` | tenant's id | Operational staff within a tenant                              |
| `end_user`     | tenant's id | Storefront customer                                            |

Every non-super user is pinned to their own tenant: the `TenantScopeGuard`
overwrites the request tenant with the token's `tenantId`, so a `tenant_*` user
cannot act outside their tenant even by changing the `X-Tenant-ID` header.

## Static RBAC

The `@Roles(Role.TENANT_ADMIN, Role.TENANT_STAFF, …)` decorator + `RolesGuard`
check the JWT's `role` claim against the required list. `super_admin` always
passes. Without `@Roles` on a route, any authenticated user passes.

`@Public()` bypasses `JwtAuthGuard` entirely (used on public catalogue, login, etc.).

## Dynamic permissions (policy engine)

Endpoints can opt into a runtime-editable policy layer with
`@RequirePermission('<apiKey>')`. The `DynamicPermissionGuard` resolves
`(tenantId, role, apiKey)` against the `permissions` collection
(`effect: 'allow' | 'deny'`) with **deny → allow → default-deny** precedence,
Redis-first and MongoDB on miss (5-min cache, invalidated on change).
`super_admin` bypasses with zero I/O. Browse every endpoint's `apiKey` via
`GET /admin/api-registry`, manage rules via `/permissions`. See
[Authorization](./authorization) for the full model.

## Super admin (god mode)

Bootstrapped once at startup from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`
(or `npm run cli bootstrap:superadmin`). Provision the first `tenant_admin` for a
tenant with `POST /admin/tenants/:tenantId/provision-admin` (super admin only),
which emails a password-set code consumed via `POST /auth/reset-password`.

## Path

The strategy file is `src/modules/auth/strategies/jwt.strategy.ts`. Tweak `JwtConfig` in `src/config/configuration.ts` for token lifetimes.
