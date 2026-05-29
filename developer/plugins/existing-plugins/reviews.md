# Reviews (Developer)

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| Plugin key   | `reviews`                                                     |
| Module class | `ReviewsPlugin` in `src/plugins/reviews/reviews.plugin.ts`    |
| Controllers  | `ProductReviewsController`, `ReviewsAdminController`          |
| Mongo schema | `reviews` (`src/plugins/reviews/schemas/review.schema.ts`)    |
| Depends on   | (none)                                                        |
| Listens to   | (none)                                                        |
| Emits        | `review.approved` ({ reviewId, userId, productId, tenantId }) |

## Flags

| Flag                   | Default | What it does                                   |
| ---------------------- | ------- | ---------------------------------------------- |
| `ratingSystem`         | `true`  | Allow public submission of reviews             |
| `moderationRequired`   | `true`  | Allow admin moderation endpoint                |
| `verifiedPurchaseOnly` | `false` | Auto-reject non-verified reviews at moderation |

## Endpoints

| Method   | Path                           | Auth        | Gating                                          |
| -------- | ------------------------------ | ----------- | ----------------------------------------------- |
| `GET`    | `/products/:productId/reviews` | Public      | `@RequiresPlugin('reviews')` (read approved)    |
| `POST`   | `/products/:productId/reviews` | Authed      | `@FeatureFlag('reviews', 'ratingSystem')`       |
| `PATCH`  | `/reviews/:id`                 | ADMIN/STAFF | `@FeatureFlag('reviews', 'moderationRequired')` |
| `DELETE` | `/reviews/:id`                 | ADMIN       | `@RequiresPlugin('reviews')`                    |

## Approval flow

```
POST /products/:id/reviews  →  status: PENDING, isVerifiedPurchase computed
                ↓
PATCH /reviews/:id { status: APPROVED }
                ↓
   recomputeRating(productId) → updates product.averageRating / reviewCount
   emit('review.approved', { reviewId, userId, productId, tenantId })
                ↓
   LoyaltyPointsService listens — awards 50 points if loyaltyPoints.pointsOnReview is on
```

## Verified-purchase logic

`ReviewsService.hasCompletedOrder` queries the `orders` collection for any order with `userId`, `items.productId` matching the review's product, and `status: COMPLETED`. Sets `isVerifiedPurchase` on the review when true.

## Cross-coupling note

Reviews imports `ProductsModule` and `OrdersModule` (both core). It does **not** import any other plugin. The loyalty integration is event-driven on `review.approved` — `ReviewsService` knows nothing about loyalty.
