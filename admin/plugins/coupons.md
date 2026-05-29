# Coupons (Admin)

The `coupons` plugin lets a tenant offer discount codes. Three flag-controlled types (`percentageCoupons`, `fixedCoupons`, `freeShippingCoupons`) plus a per-user limit toggle (`perUserLimit`).

## Endpoints

| Method   | Path                            | Role        | Purpose                            |
| -------- | ------------------------------- | ----------- | ---------------------------------- |
| `POST`   | `/api/v1/coupons/validate`      | Public      | Validate a code against a subtotal |
| `GET`    | `/api/v1/coupons/free-shipping` | Public      | List active free-shipping codes    |
| `GET`    | `/api/v1/coupons`               | ADMIN/STAFF | List all coupons                   |
| `POST`   | `/api/v1/coupons`               | ADMIN       | Create                             |
| `PATCH`  | `/api/v1/coupons/:id`           | ADMIN       | Update                             |
| `DELETE` | `/api/v1/coupons/:id`           | ADMIN       | Deactivate (soft-disable)          |

## Creating a coupon

```bash
curl -X POST http://localhost:3000/api/v1/coupons \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "code": "WELCOME10",
    "type": "percentage",
    "value": 10,
    "minOrderAmount": 50,
    "maxDiscountAmount": 25,
    "usageLimit": 1000,
    "perUserLimit": 1,
    "startsAt": "2026-05-01T00:00:00Z",
    "expiresAt": "2026-06-01T00:00:00Z"
  }'
```

`type` is `percentage | fixed | free-shipping`. `value` is the discount magnitude (`%` for percentage, `$` for fixed, ignored for free-shipping).

## Business rules

- Codes are uppercased on save.
- `usageLimit` is a global cap. `perUserLimit` only applies when the `perUserLimit` flag is enabled.
- `startsAt` / `expiresAt` define the validity window — outside it the coupon errors with `coupon.not_started` / `coupon.expired`.
- The customer-facing `POST /cart/coupon` performs a runtime feature-flag check against the coupon's `type`. If the matching flag (`percentageCoupons` etc.) is off, customers see `403`.

## Common workflow — flash discount

1. Create the coupon (`POST /coupons`).
2. Ensure `coupons.percentageCoupons` (or whichever type matches) is enabled for the tenant — see [Feature Flags](../feature-flags).
3. Publish the code in your marketing channel.
4. Monitor `usageCount` via `GET /coupons`.
5. After the campaign, `DELETE /coupons/:id` to deactivate (the record is preserved).
