# Using Coupon Codes

Coupon codes save you money on your orders. When a shop has the `coupons` feature enabled, you can apply a code to your cart and the discount is reflected immediately.

## Apply a coupon

1. Add items to your cart.
2. Apply the code:

```bash
curl -X POST http://localhost:3000/api/v1/cart/coupon \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{ "code": "WELCOME10" }'
```

3. The cart's `couponCode`, `couponDiscount` and `total` update on the response.

> [!NOTE]
> Coupons apply to the order **subtotal**, before shipping and tax.

## Coupon types

| Type          | Example     | What it does                          |
| ------------- | ----------- | ------------------------------------- |
| Percentage    | `WELCOME10` | Reduces the subtotal by a percentage  |
| Fixed amount  | `FLAT20`    | Subtracts a fixed dollar amount       |
| Free shipping | `FREESHIP`  | Removes the shipping cost at checkout |

Each type can be turned on or off per tenant by an admin (`percentageCoupons`, `fixedCoupons`, `freeShippingCoupons` flags). If your shop has, say, `fixedCoupons: false`, a fixed-amount code will be rejected with `403`.

## Remove the applied coupon

```bash
curl -X DELETE http://localhost:3000/api/v1/cart/coupon -b cookies.txt
```

## Browse active free-shipping codes (when enabled)

```bash
curl http://localhost:3000/api/v1/coupons/free-shipping
```

This is gated by the `coupons` plugin **and** the `freeShippingCoupons` flag.

## FAQ

**My coupon code says `coupon.invalid`.**
Either the code doesn't exist, is misspelled, or is inactive. Double-check the spelling and capitalization.

**It says `coupon.min_order_not_met`.**
The coupon requires a minimum cart subtotal. Add a few more items.

**It says `coupon.usage_exhausted`.**
This coupon hit its global usage cap.

**Can I stack two coupons?**
No — only one coupon at a time. Applying a new code replaces the previous one.

**Why does the same coupon work on one shop but not another?**
Coupons are per-tenant. Each shop has its own catalogue of codes and its own enabled coupon types.
