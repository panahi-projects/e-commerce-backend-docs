# Error Handling

A single global filter (`src/common/filters/http-exception.filter.ts`) catches every error thrown anywhere in the pipeline and emits a normalized JSON envelope.

## Success vs error envelope

```json
// success — TransformInterceptor
{ "success": true, "statusCode": 200, "message": "…", "data": …, "timestamp": "…" }

// error — HttpExceptionFilter
{ "success": false, "statusCode": 400, "message": "…", "errors": [ { "field": "email", "message": "must be email" } ], "timestamp": "…", "path": "/api/v1/auth/register" }
```

## Always throw, never return error objects

```typescript
// ✅
throw new BadRequestException('coupon.invalid');

// ❌ — bypasses the filter and the envelope
return { error: 'coupon.invalid' };
```

## i18n keys as messages

By convention the `message` field on a thrown `HttpException` is an i18n key (`coupon.invalid`, `tenants.not_found`). The `HttpExceptionFilter` **resolves these to localized text server-side** via `I18nService` before responding — both the top-level `message` and each `errors[]` entry — using the request language (`?lang` / `x-lang` / `Accept-Language`, default `en`). Keys with no translation, and plain non-key strings (e.g. `Validation failed`), pass through unchanged. The same helper (`src/common/utils/i18n-message.ts`) backs the success-side `TransformInterceptor`, so success and error envelopes are localized consistently.

## Validation errors

`class-validator` errors are converted by the global `ValidationPipe` into `BadRequestException`s with a `message: string[]`. The filter unpacks that into an `errors[]` array of `{ field?, message }`. The top-level `message` is `"Validation failed"`.

## 5xx logging

The filter logs `error` on status ≥ 500 with the request method, path, message, and stack trace. 4xx are not logged — they're client errors.

## Plugin / feature-flag 403s

`RequiresPluginGuard` and `FeatureFlagGuard` throw `ForbiddenException` with a human-readable message:

```
"The 'coupons' feature is not enabled for your account. Please upgrade your plan."
```

The Swagger spec advertises a `403` with the standard description on every plugin controller (see [Swagger conventions](../ai/conventions)).
