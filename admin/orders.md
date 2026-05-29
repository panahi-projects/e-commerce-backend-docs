# Orders

Process customer orders, advance their status, and handle refunds.

## Endpoints

| Method  | Path                        | Role                 | Purpose                     |
| ------- | --------------------------- | -------------------- | --------------------------- |
| `GET`   | `/api/v1/orders`            | ADMIN/STAFF          | List all orders (paginated) |
| `GET`   | `/api/v1/orders/:id`        | ADMIN/STAFF or owner | Single order                |
| `PATCH` | `/api/v1/orders/:id/status` | ADMIN/STAFF          | Transition status           |
| `POST`  | `/api/v1/orders/:id/refund` | ADMIN                | Mark refund-requested       |

## Status transitions

```
PENDING_PAYMENT → PAID → SHIPPED → DELIVERED → COMPLETED
        │                                        │
        ↓                          REFUND_REQUESTED → REFUNDED
   CANCELLED
```

The platform writes a `statusHistory` entry on every transition with `at`, `actor`, and an optional `note`.

## Advancing status

```bash
curl -X PATCH http://localhost:3000/api/v1/orders/<orderId>/status \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "status": "SHIPPED", "note": "Tracking 1Z..." }'
```

## Mark COMPLETED — triggers downstream events

Transitioning to `COMPLETED` emits an `order.completed` event with `userId`, `total`, and the tenant id. If the `loyaltyPoints` plugin is enabled for that tenant with `pointsOnPurchase: true`, the loyalty service awards points automatically. Other plugins can listen to the same event without coupling to orders.

## Refunds

```bash
curl -X POST http://localhost:3000/api/v1/orders/<orderId>/refund \
  -H 'Authorization: Bearer <admin-token>'
```

This sets the order status to `REFUND_REQUESTED`. The actual money movement is handled by the payment gateway integration — the order moves to `REFUNDED` once that succeeds.

## Business rules

- Customer-side cancellation is only allowed while the order is `PENDING_PAYMENT` or `PAID`.
- A refund can only be initiated on an order with `paymentStatus: SUCCESS`.
- Order numbers are sequential within a calendar year (`ORD-2026-00042`).
