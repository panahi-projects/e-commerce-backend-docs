# Architecture

The project is a NestJS 11 application with feature-based modules under `src/modules/` (core) and `src/plugins/` (optional features).

## Directory map

```
src/
├── main.ts                       # bootstrap (helmet, cookie-parser, validation pipe, swagger)
├── app.module.ts                 # composition root
├── config/                       # typed env + Joi validation schema
├── common/                       # cross-cutting code (guards, decorators, interceptors, redis, feature-flags, plugins)
├── database/                     # mongoose connection + seeders
├── i18n/                         # nestjs-i18n + en/ + fa/ JSON
├── mail/                         # mailer + handlebars templates + optional BullMQ queue
├── health/                       # /health endpoint (Terminus)
├── modules/                      # CORE modules — never disabled
│   ├── auth/   users/  categories/  products/  inventory/
│   ├── cart/   coupons (removed in plugin migration — now under plugins/)
│   ├── checkout/  orders/  payments/  tenants/
└── plugins/                      # PLUGIN modules — loaded conditionally
    ├── plugin.interface.ts       # PluginMetadata contract
    ├── plugin.registry.ts        # All plugin classes
    ├── plugin-loader.module.ts   # forRoot() reads ENABLED_PLUGINS
    ├── coupons/     reviews/    compare-products/  wishlist/
    ├── marketing/   analytics/  loyalty-points/    notifications/
    └── audit-logs/
```

## Module dependency direction

- Core may depend on core. Example: `CheckoutModule` imports `CartModule`, `ProductsModule`, `OrdersModule`, `PaymentsModule`, `UsersModule`.
- **Plugins may depend on core.** Example: `ReviewsPlugin` imports `ProductsModule` and `OrdersModule`.
- **Core may NOT depend on plugins.** `CartModule` and `CheckoutModule` need `CouponsService`, so they use `@Optional()` injection — the core module degrades gracefully when the plugin is not loaded.
- **Plugins may NOT depend on each other.** Cross-plugin communication uses `EventEmitter2` events.

## Request lifecycle

```
HTTP request
  ↓
mongoSanitizeMiddleware      (Mongo $-operator stripping)
  ↓
TenantMiddleware              (sets req.tenantId from subdomain / header / JWT)
  ↓
ThrottlerGuard                (rate limit)
  ↓
JwtAuthGuard                  (auth, unless @Public)
  ↓
RolesGuard                    (RBAC, via @Roles)
  ↓
RequiresPluginGuard           (APP_GUARD; checks @RequiresPlugin metadata)
  ↓
FeatureFlagGuard              (APP_GUARD; checks @FeatureFlag metadata)
  ↓
ValidationPipe                (class-validator on DTOs)
  ↓
Controller handler
  ↓
TransformInterceptor          (wraps in envelope)
HttpExceptionFilter           (envelope on error)
```

All four guards (`Throttler`, `JwtAuth`, `Roles` per-route, `RequiresPlugin`, `FeatureFlag`) run via `APP_GUARD` providers in `AppModule`, plus `FeatureFlagsModule`. Decorators set metadata only — they do **not** call `@UseGuards` themselves.

## Response envelope

Every successful response is wrapped by `TransformInterceptor`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "...",
  "data": <payload>,
  "meta": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 },
  "timestamp": "..."
}
```

Errors go through `HttpExceptionFilter` and produce a parallel `ApiError` shape.

## Plugin architecture in two lines

- `PluginLoaderModule.forRoot()` reads `ENABLED_PLUGINS`, validates `dependsOn`, and registers the matching DynamicModules at boot.
- `FeatureFlagService` reads the tenant document from Mongo (Redis-cached, 5 min TTL) and answers `isPluginEnabled` / `isFlagEnabled` at request time.
