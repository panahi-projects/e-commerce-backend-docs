# Getting Started

Welcome. This section explains how to use the storefront as a customer. No technical background required.

## What you can do

- Create an account (or shop as a guest)
- Browse and search products
- Add things to your cart and check out
- Track your orders and request cancellation while the order is still pending
- Manage your profile, shipping addresses, and saved details
- Use plugin features like coupon codes, wishlist, product comparison, reviews, and loyalty points — when your shop has them enabled

## How to read these guides

Each page focuses on one task. Pages include:

- A plain-English explanation of what the feature does.
- Numbered step-by-step instructions.
- A `curl` example so you (or your support team) can reproduce the call from a terminal.
- An **FAQ** at the bottom covering the most common questions.

> [!TIP]
> If a feature page tells you `403 Forbidden` is a possible answer, that means the feature is not enabled on your shop. Ask the shop operator to enable it for your tenant.

## Multi-tenant note

Every request runs in the context of one **tenant** (one shop). The platform figures out which tenant you belong to automatically — usually from the shop's subdomain (`acme.example.com`) or from an `X-Tenant-ID` header your client sets. As a customer, you do not need to think about it.

## Where next

- [Authentication](./authentication) — how login, OTP, and password reset work.
- [Browsing & Search](./browsing) — how to find products.
- [Cart](./cart) — adding items, applying coupons.
- [Checkout](./checkout) — placing an order.
- [Orders](./orders) — order history and cancellation.
- [Profile](./profile) — addresses, saved details.
- Feature guides — [coupons](./plugins/coupons), [reviews](./plugins/reviews), [wishlist](./plugins/wishlist), [compare](./plugins/compare), [loyalty points](./plugins/loyalty-points).
