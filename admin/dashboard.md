# Dashboard

The dashboard is the analytics landing page. It is gated by the `analytics` plugin — your tenant must have it enabled, and the analytics endpoints honour per-flag toggles on top of that.

## Headline counters

```bash
curl http://localhost:3000/api/v1/analytics/dashboard \
  -H 'Authorization: Bearer <admin-token>'
```

Returns paid-order counts and revenue for `today`, `week` (last 7 days), `month` (current month), plus `totalCustomers`.

## Reports

| Endpoint                       | Flag              | Notes                                                         |
| ------------------------------ | ----------------- | ------------------------------------------------------------- |
| `GET /analytics/sales`         | `salesReports`    | Daily buckets `[{ date, orders, revenue }]` over a date range |
| `GET /analytics/products/top`  | `productReports`  | Top sellers in a date range (`?limit=10`)                     |
| `GET /analytics/customers/top` | `customerReports` | Top customers by spend in a date range                        |
| `GET /analytics/funnel`        | `funnelAnalysis`  | Orders created vs paid + conversion rate                      |

All endpoints accept `?from=YYYY-MM-DD&to=YYYY-MM-DD`. The dashboard counters do not — they're fixed windows.

## Business workflow — weekly KPIs review

1. Pull `/analytics/dashboard` for the headline numbers.
2. Pull `/analytics/sales?from=<seven-days-ago>` for the daily curve.
3. Pull `/analytics/products/top?limit=20&from=<…>&to=<…>` to spot trending SKUs.
4. Pull `/analytics/funnel?from=<…>` to inspect the paid-to-created ratio.

If any pull returns `403`, either the `analytics` plugin is off for this tenant or the specific flag (`salesReports`, etc.) is off.

## Business rules

- Numbers are based on orders with `paymentStatus: SUCCESS`. Refunded orders are excluded from revenue.
- Top-customers excludes guest orders (`userId: null`).
- All revenue numbers are rounded to 2 decimals server-side.
