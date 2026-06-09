# Loyalty Points (Admin)

The `loyaltyPoints` plugin runs a per-tenant ledger. Three flags gate behaviour:

| Flag               | Effect                                                 |
| ------------------ | ------------------------------------------------------ |
| `pointsOnPurchase` | Award `floor(order.total)` points on `order.completed` |
| `pointsOnReview`   | Award `50` points on `review.approved`                 |
| `pointsRedemption` | Customer endpoint `POST /loyalty/redeem` is enabled    |

The plugin declares `dependsOn: ['reviews']` — enabling it for a tenant that does not have `reviews` enabled returns `400`.

## Endpoints

| Method | Path                             | Role               | Purpose                          |
| ------ | -------------------------------- | ------------------ | -------------------------------- |
| `GET`  | `/api/v1/loyalty/balance`        | Authed             | The caller's balance             |
| `GET`  | `/api/v1/loyalty/transactions`   | Authed             | The caller's transaction history |
| `POST` | `/api/v1/loyalty/redeem`         | Authed             | Spend points (gated by flag)     |
| `GET`  | `/api/v1/loyalty/admin/accounts` | tenant_admin/staff | All loyalty accounts for tenant  |
| `POST` | `/api/v1/loyalty/admin/adjust`   | tenant_admin/staff | Manually credit / debit          |

## Manually adjusting a balance

```bash
curl -X POST http://localhost:3000/api/v1/loyalty/admin/adjust \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "65...",
    "delta": 250,
    "reason": "customer service credit"
  }'
```

A negative `delta` debits. The adjustment is rejected if it would drop the balance below zero.

## Common workflow — refund-related credit

1. Refund the order via `POST /orders/:id/refund`.
2. Use `POST /loyalty/admin/adjust` with a positive `delta` and `reason: 'refund credit'` to compensate the customer in points.

## How earning actually works

The plugin **listens to events**, never reads orders or reviews directly:

- `order.completed` (emitted by `OrdersService.updateStatus` on transition to COMPLETED).
- `review.approved` (emitted by `ReviewsService.moderate` on approval).

Each handler checks the feature flag for that tenant before awarding. Disabling the plugin (or the flag) stops awards immediately on the next event.
