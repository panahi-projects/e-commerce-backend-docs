# Checkout

Checkout turns your cart into an order and initiates payment.

## Prerequisites

- You must be logged in. Guest checkout is not supported — log in first and use `POST /cart/merge` to bring your guest cart along.
- Your profile must have a `firstName`, a `lastName`, and at least one saved address — otherwise checkout returns `400 checkout.identity_incomplete`. See the [Profile guide](./profile).
- Your cart must not be empty.
- All variants in your cart must still be in stock at the moment of checkout.

## Initiating checkout

```bash
curl -X POST http://localhost:3000/api/v1/checkout/initiate \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "shippingAddress": {
      "fullName": "Jane Doe",
      "phone": "+1-555-0100",
      "line1": "42 Maple St",
      "city": "Austin",
      "state": "TX",
      "postalCode": "73301",
      "country": "US"
    },
    "billingAddress": null,
    "notes": "Leave at the door"
  }'
```

Pass `billingAddress: null` to reuse the shipping address.

## What the server does

1. Re-validates every line item — the variant must still exist and its price must still match what you saw in the cart.
2. Re-validates any applied coupon (if the `coupons` plugin is enabled).
3. Computes shipping (`$10` flat, free over `$100`) and tax (`8%` of `subtotal − discount`).
4. Decrements stock for each variant.
5. Creates an order in `PENDING_PAYMENT` status.
6. Initiates a payment with the configured gateway.

The response includes:

```json
{
  "orderId": "65...",
  "orderNumber": "ORD-2026-00042",
  "total": 134.4,
  "payment": {
    "reference": "MOCK-TXN-...",
    "redirectUrl": "...",
    "transactionId": "..."
  }
}
```

## Confirming payment

After the gateway redirects back, your client calls confirm:

```bash
curl -X POST http://localhost:3000/api/v1/checkout/confirm \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "orderId": "65...", "reference": "MOCK-TXN-..." }'
```

If the gateway confirms success, the order transitions to `PAID` and your cart is cleared.

## Cancelling before payment

```bash
curl -X POST http://localhost:3000/api/v1/checkout/cancel \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "orderId": "65..." }'
```

Only orders in `PENDING_PAYMENT` can be cancelled this way. Reserved stock is returned to the catalogue.

## FAQ

**My coupon was rejected at checkout but it was fine in the cart.**
The coupon is re-validated at checkout time. The most common cause is the coupon expiring or hitting its usage limit between cart and checkout. If the shop disabled the relevant `coupons` flag (e.g. `freeShippingCoupons: false`) in that window, you'll see a 403 instead.

**Why does the price differ from the cart?**
Prices and taxes are computed at checkout against the live product data. If a product's `unitPrice` changed, the order reflects the new price.

**Can I change the shipping address after placing the order?**
No — once the order is created, edits are an admin operation. Contact support.
