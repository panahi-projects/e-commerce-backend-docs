# Orders

Where to look up past orders and what status transitions to expect.

## My orders

```bash
curl 'http://localhost:3000/api/v1/orders/my?page=1&limit=10' \
  -H 'Authorization: Bearer <access-token>'
```

Filter by status with `?status=PAID` (`PENDING_PAYMENT`, `PAID`, `SHIPPED`, `DELIVERED`, `COMPLETED`, `CANCELLED`, `REFUND_REQUESTED`, `REFUNDED`).

## One order

```bash
curl http://localhost:3000/api/v1/orders/<orderId> \
  -H 'Authorization: Bearer <access-token>'
```

You can read an order if you're the owner OR an admin/staff member.

## Order lifecycle

```
PENDING_PAYMENT  ──▶  PAID  ──▶  SHIPPED  ──▶  DELIVERED  ──▶  COMPLETED
        │                                                          │
        └──▶ CANCELLED                  REFUND_REQUESTED  ──▶  REFUNDED
```

The platform writes a `statusHistory` entry on every transition so you (and the admin) can see who did what and when.

## Cancelling

Only orders in `PENDING_PAYMENT` or `PAID` can be self-cancelled by the customer:

```bash
curl -X POST http://localhost:3000/api/v1/orders/<orderId>/cancel \
  -H 'Authorization: Bearer <access-token>'
```

After shipment, contact support to request a refund instead.

## Loyalty points on COMPLETED orders

If the shop has the `loyaltyPoints` plugin enabled with `pointsOnPurchase: true`, you earn 1 point per `$1` of the order total when the admin marks the order `COMPLETED`. The points appear in your loyalty balance shortly after.

## FAQ

**My order is still in PAID — when does it ship?**
The shop operator transitions PAID → SHIPPED manually after dispatch. ETAs are shop-specific.

**Why isn't my order showing earned points?**
Points are awarded only when the order reaches `COMPLETED`. Until then, the line in your transaction history won't exist.

**Can I split an order across multiple shipments?**
Not in the current MVP — one order is one shipment.
