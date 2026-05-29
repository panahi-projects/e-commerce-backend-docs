# Wishlist (Developer)

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Plugin key      | `wishlist`                                                               |
| Module class    | `WishlistPlugin` in `src/plugins/wishlist/wishlist.plugin.ts`            |
| Controller path | `/api/v1/wishlist`                                                       |
| Storage         | The `User.wishlist` field (`Types.ObjectId[]`) in the `users` collection |
| Depends on      | (none, but imports `UsersModule`)                                        |

## Flags

| Flag             | Default | What it does                                                    |
| ---------------- | ------- | --------------------------------------------------------------- |
| `publicWishlist` | `false` | Enables `GET /wishlist/:userId/public`                          |
| `shareWishlist`  | `false` | Enables `POST /wishlist/share` (returns a one-time share token) |

## Endpoints

| Method   | Path                       | Auth   | Gating                                       |
| -------- | -------------------------- | ------ | -------------------------------------------- |
| `GET`    | `/wishlist`                | Authed | `@RequiresPlugin('wishlist')`                |
| `POST`   | `/wishlist/:productId`     | Authed | `@RequiresPlugin('wishlist')`                |
| `DELETE` | `/wishlist/:productId`     | Authed | `@RequiresPlugin('wishlist')`                |
| `POST`   | `/wishlist/share`          | Authed | `@FeatureFlag('wishlist', 'shareWishlist')`  |
| `GET`    | `/wishlist/:userId/public` | Public | `@FeatureFlag('wishlist', 'publicWishlist')` |

## Route ordering

`POST /wishlist/share` is declared **before** `POST /wishlist/:productId` so Nest matches the literal first. `GET /wishlist/:userId/public` is two-segment and doesn't conflict with the single-segment `:productId` routes.

## Why this is a plugin, not part of users

Wishlists are an optional commerce feature — some shops don't want them. Splitting them out lets a tenant disable the plugin without touching the rest of the user surface. The data still lives on the `User` document so a future migration to dedicated collections is purely additive.

## No emitted events (today)

A future iteration could emit `wishlist.added` when products are saved (cross-sell campaigns, recommender training).
