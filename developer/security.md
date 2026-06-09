# Security

What's wired up out of the box.

## HTTP layer

| Concern         | Mechanism                                                            |
| --------------- | -------------------------------------------------------------------- |
| HTTP headers    | `helmet()` in `src/main.ts`                                          |
| CORS            | `app.enableCors(...)` with `CORS_ORIGINS` allowlist                  |
| Body limit      | `BODY_LIMIT` env (default `10mb`)                                    |
| Rate limiting   | `@nestjs/throttler` — global guard with `default` and `auth` buckets |
| Mongo injection | `mongoSanitizeMiddleware` strips `$`-prefixed keys at the boundary   |
| Cookie security | `cookie-parser` + `httpOnly`, `sameSite: 'strict'`, `secure` in prod |

## Auth

- JWT access tokens (default 15 min, `JWT_ACCESS_EXPIRES_IN`) — `JwtAuthGuard` as global guard, opt out with `@Public()`.
- Refresh tokens hashed in MongoDB — server-side revocation supported.
- bcrypt with `BCRYPT_ROUNDS` (default 12) for password hashes.
- OTP with attempt cap (`OTP_MAX_ATTEMPTS`, default 5) and TTL (`OTP_TTL_MINUTES`, default 10).
- RBAC via `@Roles()` + `RolesGuard`.

## Multi-tenant isolation

- `TenantMiddleware` sets `req.tenantId` for every request.
- `FeatureFlagService` reads the tenant's config — every plugin/flag check is per-tenant.
- A soft-deleted (`isActive: false`) tenant fails closed: every plugin check returns `false`.

## Input validation

A single global `ValidationPipe` with:

```typescript
{ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }
```

DTOs are decorated with `class-validator`. Extra fields are rejected (`forbidNonWhitelisted`).

## Sensitive data in responses

`passwordHash` is declared `@Prop({ select: false })` on the `User` schema, so it
is **excluded from every query by default** — it can never leak through an
endpoint that returns a user document (profile, admin user lists, etc.), even
through `.lean()` paginated results. The auth flows that genuinely need it
(login, set/change password, 2FA) opt back in per-query via
`.select('+passwordHash')` (exposed through the `withSecret` flag on the
`UsersService` finders). `GET /auth/me` returns only the derived
`hasPassword: boolean`, never the hash itself.

## What's not yet implemented

- CSRF protection on cookie-authenticated routes (the API is API-only; CSRF is the frontend's problem).
- Per-tenant rate limit buckets (the throttler currently uses one global bucket).

> **Audit logging is now implemented** as the `auditLogs` plugin — security
> events (logins, role changes, password changes, etc.) are recorded and exposed
> via `GET /audit-logs`, with TTL-based retention
> (`AUDIT_LOG_RETENTION_DAYS`, default 90). See
> [Audit Logs plugin](./plugins/existing-plugins/audit-logs).
