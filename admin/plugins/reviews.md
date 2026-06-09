# Reviews (Admin)

The `reviews` plugin lets customers rate products. Three flags control behaviour:

| Flag                   | Effect                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `ratingSystem`         | Customers can post new reviews (off → public POST returns 403)                         |
| `moderationRequired`   | Moderation endpoint is enabled (off → admin patch returns 403)                         |
| `verifiedPurchaseOnly` | Reviews from users who haven't bought the product are auto-rejected at moderation time |

## Endpoints

| Method   | Path                                  | Role               | Purpose                                          |
| -------- | ------------------------------------- | ------------------ | ------------------------------------------------ |
| `GET`    | `/api/v1/products/:productId/reviews` | Public             | List approved reviews                            |
| `POST`   | `/api/v1/products/:productId/reviews` | Authed             | Submit a review (gated by `ratingSystem`)        |
| `PATCH`  | `/api/v1/reviews/:id`                 | tenant_admin/staff | Approve / reject (gated by `moderationRequired`) |
| `DELETE` | `/api/v1/reviews/:id`                 | tenant_admin       | Hard-delete                                      |

## Moderating

```bash
curl -X PATCH http://localhost:3000/api/v1/reviews/<reviewId> \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "status": "APPROVED" }'
```

Acceptable `status` values: `APPROVED`, `REJECTED`.

Approving a review:

1. Recomputes the product's `averageRating` and `reviewCount`.
2. Emits `review.approved` (consumed by the loyalty plugin when its `pointsOnReview` flag is on — no direct coupling).

## Common workflow — daily moderation

1. Pull pending reviews from your storage layer (status filtered query).
2. Approve or reject each one.
3. Watch the loyalty ledger if `pointsOnReview` is enabled — points are awarded automatically.
