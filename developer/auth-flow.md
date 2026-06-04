# Auth Flow

Dual-token JWT — short-lived access token + long-lived refresh token in an httpOnly cookie. Both secrets must be at least 32 chars (validated by Joi at boot).

## Registration & login (OTP-first / passwordless)

Registration takes a **single identifier** that is auto-detected as an email or an Iranian mobile number — no name, no password. The account is created passwordless and an OTP is sent over the matching channel; tokens are issued only after the OTP is verified.

| Step | Endpoint | Body | Result |
| ---- | -------- | ---- | ------ |
| Register | `POST /auth/register` | `{ identifier }` | Creates the account, sends an OTP via email **or** SMS, returns `{ identifier, channel }` — no tokens. `409` if the identifier already exists. |
| Login (request) | `POST /auth/request-otp` | `{ identifier }` | Sends a fresh OTP to an existing account. Silent on unknown identifiers (no account enumeration). |
| Verify | `POST /auth/verify-otp` | `{ identifier, code }` | Consumes the OTP, marks the email/phone verified, **issues tokens** (sets the refresh cookie). Completes both registration and login. |
| Set password (opt-in) | `POST /auth/set-password` | `{ newPassword }` (authed) | Lets an OTP-first account enable classic password login. |

Password login (`POST /auth/login`) still works for accounts that have a password (seeded admins, or users who called set-password). Passwordless accounts get `401` on password login until they set one.

> [!TIP]
> Outside production the issued OTP is logged to the server console as `[DEV OTP] <PURPOSE> for <identifier>: <code>` so you can copy/paste it during local testing (email also lands in Mailtrap, SMS in the sms.ir sandbox).

> [!NOTE]
> Profile details (first name, last name, address) are filled later via the profile endpoints. Checkout enforces them — see [Checkout identity gate](#identity-gate).

## Tokens

| Token         | Lifetime | Storage                           | Purpose                                             |
| ------------- | -------- | --------------------------------- | --------------------------------------------------- |
| Access JWT    | 15 min   | Client memory (response body)     | Sent on every API call as `Authorization: Bearer …` |
| Refresh token | 7 days   | httpOnly cookie (`refresh_token`) | Used only to renew the access token                 |

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
| SMS     | `POST /auth/otp/send-sms` | `POST /auth/otp/verify-sms` | `SmsService` → sms.ir `/send/verify` (see [SMS](./sms)) |

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
