# Loyalty Points (Developer)

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| Plugin key      | `loyaltyPoints`                                                                     |
| Module class    | `LoyaltyPointsPlugin` in `src/plugins/loyalty-points/loyalty-points.plugin.ts`      |
| Controller path | `/api/v1/loyalty`                                                                   |
| Mongo schema    | `loyalty_accounts` (`src/plugins/loyalty-points/schemas/loyalty-account.schema.ts`) |
| Depends on      | `['reviews']` — listens to `review.approved`                                        |
| Listens to      | `order.completed`, `review.approved`                                                |
| Emits           | (none)                                                                              |

## Flags

| Flag               | Default | What it does                                              |
| ------------------ | ------- | --------------------------------------------------------- |
| `pointsOnPurchase` | `true`  | Handler awards `floor(total)` points on `order.completed` |
| `pointsOnReview`   | `false` | Handler awards `50` points on `review.approved`           |
| `pointsRedemption` | `true`  | Customer endpoint `POST /loyalty/redeem` is enabled       |

## Schema

```typescript
LoyaltyAccount {
  userId: ObjectId,
  tenantId: string,                       // composite uniqueness: { tenantId, userId }
  totalEarned: number,
  totalRedeemed: number,
  balance: number,                        // computed by applyDelta
  transactions: [{
    type: 'earn' | 'redeem' | 'expire' | 'adjustment',
    points: number,                       // signed delta
    reason: 'purchase' | 'review' | 'manual' | ...,
    referenceId?: string,                 // orderId or reviewId
    createdAt: Date,
  }],
}
```

Compound unique index on `{ tenantId, userId }` — one account per user per tenant.

## Endpoints

| Method | Path                      | Auth        | Gating                                              |
| ------ | ------------------------- | ----------- | --------------------------------------------------- |
| `GET`  | `/loyalty/balance`        | Authed      | `@RequiresPlugin('loyaltyPoints')`                  |
| `GET`  | `/loyalty/transactions`   | Authed      | `@RequiresPlugin('loyaltyPoints')`                  |
| `POST` | `/loyalty/redeem`         | Authed      | `@FeatureFlag('loyaltyPoints', 'pointsRedemption')` |
| `GET`  | `/loyalty/admin/accounts` | ADMIN/STAFF | `@RequiresPlugin('loyaltyPoints')`                  |
| `POST` | `/loyalty/admin/adjust`   | ADMIN/STAFF | `@RequiresPlugin('loyaltyPoints')`                  |

## Event handlers

```typescript
@OnEvent('order.completed')
async handleOrderCompleted(event: OrderCompletedEvent) {
  if (!await this.featureFlags.isFlagEnabled(event.tenantId, 'loyaltyPoints', 'pointsOnPurchase')) return;
  const points = Math.floor(event.total * POINTS_PER_DOLLAR);
  if (points <= 0) return;
  await this.applyDelta(account, { type: EARN, delta: points, reason: 'purchase', referenceId: event.orderId });
}

@OnEvent('review.approved')
async handleReviewApproved(event: ReviewApprovedEvent) {
  if (!await this.featureFlags.isFlagEnabled(event.tenantId, 'loyaltyPoints', 'pointsOnReview')) return;
  await this.applyDelta(account, { type: EARN, delta: POINTS_PER_REVIEW, reason: 'review', referenceId: event.reviewId });
}
```

Both flag checks happen inside the handler — events don't run inside the request pipeline, so the guards can't help.

## applyDelta

The single mutation primitive — adds the signed delta to `balance`, adds positive deltas to `totalEarned` and the absolute value of negative deltas to `totalRedeemed`, and appends a transaction record. Used by every event handler, redemption, and admin-adjust.

## dependsOn enforcement

`['reviews']` means: if you put `loyaltyPoints` in `ENABLED_PLUGINS` but not `reviews`, the loader **throws at boot**. Same check at admin-time: `PATCH /admin/tenants/:id/plugins/loyaltyPoints/enable` returns `400` if `reviews` isn't already on for that tenant.
