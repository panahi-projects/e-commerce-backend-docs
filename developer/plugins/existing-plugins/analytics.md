# Analytics (Developer)

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Plugin key      | `analytics`                                                        |
| Module class    | `AnalyticsPlugin` in `src/plugins/analytics/analytics.plugin.ts`   |
| Controller path | `/api/v1/analytics`                                                |
| Storage         | None of its own — aggregates over `orders` and `users` collections |
| Depends on      | (imports `OrdersModule`, `UsersModule`; no plugin dependsOn)       |

## Flags

| Flag              | Default | What it does                         |
| ----------------- | ------- | ------------------------------------ |
| `salesReports`    | `true`  | Gates `GET /analytics/sales`         |
| `customerReports` | `true`  | Gates `GET /analytics/customers/top` |
| `productReports`  | `true`  | Gates `GET /analytics/products/top`  |
| `funnelAnalysis`  | `false` | Gates `GET /analytics/funnel`        |

The `/analytics/dashboard` summary is gated by the plugin (`@RequiresPlugin`) but not by any specific flag.

## Endpoints

| Method | Path                       | Auth        | Gating                                         |
| ------ | -------------------------- | ----------- | ---------------------------------------------- |
| `GET`  | `/analytics/dashboard`     | ADMIN/STAFF | `@RequiresPlugin('analytics')` only            |
| `GET`  | `/analytics/sales`         | ADMIN/STAFF | `@FeatureFlag('analytics', 'salesReports')`    |
| `GET`  | `/analytics/products/top`  | ADMIN/STAFF | `@FeatureFlag('analytics', 'productReports')`  |
| `GET`  | `/analytics/customers/top` | ADMIN/STAFF | `@FeatureFlag('analytics', 'customerReports')` |
| `GET`  | `/analytics/funnel`        | ADMIN/STAFF | `@FeatureFlag('analytics', 'funnelAnalysis')`  |

## Aggregation pipelines

All reports use the Mongo aggregation framework against the `orders` collection. The base date filter is built by `buildDateMatch` and matches `createdAt` (inclusive bounds).

- `salesReport` — buckets daily with `$dateToString` on `createdAt`. Only `paymentStatus: SUCCESS`.
- `topProducts` — `$unwind` items, `$group` by productId, sort by quantity.
- `topCustomers` — `$group` by `userId`, sort by revenue, join `users` via `$lookup`. Excludes `userId: null`.
- `funnel` — single `$group` returning `ordersCreated` (all), `ordersPaid` (success), and revenue.

## Future caching

Reports run on raw data today. If a tenant's order volume grows, cache the JSON response in Redis keyed by tenantId + endpoint + date range, with short TTL (a few minutes). The flag-based gating already gives you tenant-level control over which reports get computed.
