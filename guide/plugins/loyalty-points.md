# Loyalty Points

Earn points on purchases (and sometimes reviews), redeem them for benefits the shop offers. Only available on shops with the `loyaltyPoints` plugin enabled.

## Check my balance

```bash
curl http://localhost:3000/api/v1/loyalty/balance -H 'Authorization: Bearer <access-token>'
```

Response includes `balance`, `totalEarned`, and `totalRedeemed`.

## Transaction history

```bash
curl http://localhost:3000/api/v1/loyalty/transactions -H 'Authorization: Bearer <access-token>'
```

Each entry has a `type` (`earn`, `redeem`, `expire`, `adjustment`), a signed `points` delta, a `reason` (`purchase`, `review`, `manual`, etc.), and optional `referenceId` (the order or review that triggered the award).

## Earning rules

| Action          | Flag               | Points (defaults)           |
| --------------- | ------------------ | --------------------------- |
| Order completed | `pointsOnPurchase` | `floor(total)` (1 per `$1`) |
| Review approved | `pointsOnReview`   | `50`                        |

The order has to reach the `COMPLETED` status (admin transitions it manually after delivery). Reviews count only after the moderator approves them.

## Redeem points

If the shop has `pointsRedemption: true`:

```bash
curl -X POST http://localhost:3000/api/v1/loyalty/redeem \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "points": 100 }'
```

The redemption records a `redeem` transaction. The shop's checkout integration decides how to translate points into discounts.

> [!WARNING]
> Redeeming more points than you have returns `400 loyalty-points.insufficient_balance`.

## FAQ

**My order is paid but no points yet.**
Points are awarded on `COMPLETED`, not `PAID`. The shop transitions the order manually after delivery.

**My points were adjusted up/down — why?**
An admin can manually adjust balances (refunds, customer-service compensation, expirations). Those show up as `adjustment` transactions with a `reason` field explaining the change.

**Are points per-shop or shared across the platform?**
Per-shop (per-tenant). Each tenant has its own loyalty ledger.
