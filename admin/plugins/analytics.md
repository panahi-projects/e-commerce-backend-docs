# Analytics (Admin)

The `analytics` plugin exposes admin-only dashboards. Four flags gate the per-route surface:

| Flag              | Endpoint                       |
| ----------------- | ------------------------------ |
| `salesReports`    | `GET /analytics/sales`         |
| `productReports`  | `GET /analytics/products/top`  |
| `customerReports` | `GET /analytics/customers/top` |
| `funnelAnalysis`  | `GET /analytics/funnel`        |

The `/analytics/dashboard` summary itself is not flag-gated (only the plugin gate applies).

## Sales report

```bash
curl 'http://localhost:3000/api/v1/analytics/sales?from=2026-04-01&to=2026-04-30' \
  -H 'Authorization: Bearer <admin-token>'
```

Returns daily buckets `[{ date, orders, revenue }]`. Only orders with `paymentStatus: SUCCESS` are counted.

## Top products / customers

```bash
curl 'http://localhost:3000/api/v1/analytics/products/top?limit=10&from=2026-04-01' \
  -H 'Authorization: Bearer <admin-token>'

curl 'http://localhost:3000/api/v1/analytics/customers/top?limit=10&from=2026-04-01' \
  -H 'Authorization: Bearer <admin-token>'
```

`customers/top` excludes guest orders.

## Funnel

```bash
curl 'http://localhost:3000/api/v1/analytics/funnel?from=2026-04-01' \
  -H 'Authorization: Bearer <admin-token>'
```

Returns `{ ordersCreated, ordersPaid, revenue, conversionRate }` for the date window.

## Business rules

- All revenue numbers are rounded server-side to 2 decimal places.
- Dates are inclusive on both ends and indexed against `order.createdAt`.
- The dashboard summary uses fixed windows (today / 7d / current month) — for arbitrary windows, use the per-flag endpoints.
