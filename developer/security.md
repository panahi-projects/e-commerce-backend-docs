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
| Cookie security | `cookie-parser` + `httpOnly`, `sameSite: 'lax'`, `secure` in prod    |

## Auth

- JWT access tokens (15 min) — `JwtAuthGuard` as global guard, opt out with `@Public()`.
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

`User` schema exposes `passwordHash`; `TransformInterceptor` does not strip it implicitly. Use `.select('-passwordHash')` or a DTO mapping in any service method that returns a user document.

## What's not yet implemented

- CSRF protection on cookie-authenticated routes (the API is API-only; CSRF is the frontend's problem).
- Per-tenant rate limit buckets (the throttler currently uses one global bucket).
- Audit log of admin actions — recommended next step.
