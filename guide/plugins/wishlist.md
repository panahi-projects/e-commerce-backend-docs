# Wishlist

Save products you might want to buy later. Wishlists are per-user and tied to your account.

## Add a product

```bash
curl -X POST http://localhost:3000/api/v1/wishlist/<productId> \
  -H 'Authorization: Bearer <access-token>'
```

## List my wishlist

```bash
curl http://localhost:3000/api/v1/wishlist -H 'Authorization: Bearer <access-token>'
```

Returns an array of product ids. The storefront client uses those ids to load the full product details.

## Remove a product

```bash
curl -X DELETE http://localhost:3000/api/v1/wishlist/<productId> \
  -H 'Authorization: Bearer <access-token>'
```

## Share my wishlist (when enabled)

If the shop has `shareWishlist: true`:

```bash
curl -X POST http://localhost:3000/api/v1/wishlist/share \
  -H 'Authorization: Bearer <access-token>'
```

Returns a one-time share token your client can put in a link.

## View someone's public wishlist (when enabled)

If the shop has `publicWishlist: true`:

```bash
curl http://localhost:3000/api/v1/wishlist/<userId>/public
```

Returns the product ids on that user's wishlist. No authentication required.

> [!NOTE]
> If either feature is disabled for the tenant, the corresponding endpoint returns `403`.

## FAQ

**Where did the wishlist endpoints under /profile go?**
They were moved to their own plugin so they can be turned off per tenant. The behaviour is the same.

**Can I have multiple wishlists?**
Not in the current MVP — one wishlist per account.

**My friend can't see my wishlist.**
Two possibilities: the shop has `publicWishlist: false` (ask the operator), or the URL is using the wrong user id.
