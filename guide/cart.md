# Cart

The cart stores items you've selected but not yet purchased. It works whether you're logged in or browsing as a guest.

## How carts are identified

| Situation      | Identifier                                       |
| -------------- | ------------------------------------------------ |
| Logged-in user | The cart belongs to your user id                 |
| Guest          | A `cart_session` cookie set by the first request |

When you log in after building a guest cart, you can merge the two carts.

## Adding an item

```bash
curl -X POST http://localhost:3000/api/v1/cart/items \
  -H 'Content-Type: application/json' \
  -b cookies.txt -c cookies.txt \
  -d '{
    "productId": "65aa...",
    "sku": "RED-42",
    "quantity": 2
  }'
```

The server fetches the product, locates the matching variant by `sku`, verifies stock, and either creates a new line item or increments the quantity of an existing line.

## Viewing the cart

```bash
curl http://localhost:3000/api/v1/cart -b cookies.txt
```

The response includes `items`, `subtotal`, `couponDiscount`, `total`, and an `expiresAt` (carts expire after 30 days of inactivity).

## Updating a line

```bash
curl -X PATCH http://localhost:3000/api/v1/cart/items/<itemId> \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{ "quantity": 3 }'
```

## Removing a line

```bash
curl -X DELETE http://localhost:3000/api/v1/cart/items/<itemId> -b cookies.txt
```

## Emptying the cart

```bash
curl -X DELETE http://localhost:3000/api/v1/cart -b cookies.txt
```

This clears all items **and** any applied coupon.

## Applying a coupon

If the shop has the `coupons` plugin enabled:

```bash
curl -X POST http://localhost:3000/api/v1/cart/coupon \
  -H 'Content-Type: application/json' \
  -b cookies.txt \
  -d '{ "code": "WELCOME10" }'
```

If the coupons plugin is not enabled for this tenant, the response is `400` with the message `cart.coupons_plugin_disabled`.

## Merging on login

```bash
curl -X POST http://localhost:3000/api/v1/cart/merge \
  -H 'Authorization: Bearer <access-token>' \
  -b cookies.txt
```

Any items from your guest cart are added to your user cart (duplicate line items are summed). The guest cart is then deleted and the cookie cleared.

## FAQ

**My cart disappeared.**
Carts expire after 30 days without activity. Anything in your wishlist is preserved separately.

**Can I apply more than one coupon?**
No — the cart holds at most one coupon code at a time. Applying a second one replaces the first.

**Why was a variant rejected with `out_of_stock`?**
The stock count is checked at the variant level, not the product level. The variant you selected has fewer units in stock than the quantity you requested.
