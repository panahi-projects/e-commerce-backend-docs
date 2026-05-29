# Product Reviews

If the shop has the `reviews` feature enabled, you can rate and review products you bought.

## Read reviews on a product

```bash
curl http://localhost:3000/api/v1/products/<productId>/reviews
```

Returns only **approved** reviews. Reviews pending moderation or rejected don't show up here.

## Post a review

```bash
curl -X POST http://localhost:3000/api/v1/products/<productId>/reviews \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "rating": 5, "title": "Loved it", "body": "Fits great." }'
```

- `rating` is `1`-`5`.
- `title` is short (under 100 chars).
- `body` is the longer-form review.

The review is created in `PENDING` status. The shop's admin or staff approves or rejects it.

## Verified-purchase

When you post a review, the platform checks whether your account has at least one `COMPLETED` order containing the product. If so, the review is marked `isVerifiedPurchase: true`.

Some shops require verified purchases for reviews (`verifiedPurchaseOnly: true`). On those shops, your non-purchase reviews are auto-rejected during moderation.

## What happens after approval

When an admin approves your review:

- It appears in the public listings.
- The product's `averageRating` and `reviewCount` are recomputed.
- The shop emits a `review.approved` event. If `loyaltyPoints.pointsOnReview` is on, you get 50 loyalty points.

> [!TIP]
> Reviews are a great way to earn loyalty points on shops where that flag is enabled. Check your shop's loyalty terms first.

## FAQ

**My review is stuck in "pending".**
Reviews are moderated by the shop's staff. If it takes too long, contact support.

**Can I edit a posted review?**
Not yet — the MVP doesn't support customer-side edits. An admin can delete it for you, then you can post a new one.

**Why was my review rejected?**
The most common reason on shops with `verifiedPurchaseOnly: true` is that you didn't buy the product. Otherwise the shop's moderation policy applies.
