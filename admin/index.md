# Admin Overview

This section is for operators — shop owners, support staff, and platform administrators. It covers day-to-day operations and the multi-tenant controls unique to this platform.

## Who can do what

| Role       | Capabilities                                                                      |
| ---------- | --------------------------------------------------------------------------------- |
| `ADMIN`    | Everything: tenant config, plugin/flag toggles, refunds, user management          |
| `STAFF`    | Catalogue work, order processing, review moderation, but no tenant/plugin control |
| `CUSTOMER` | Storefront usage only                                                             |

Most admin endpoints live under `/api/v1/admin/...`. All require a bearer JWT belonging to a user with the right role — and they all run in the context of a tenant (resolved from subdomain, `X-Tenant-ID`, or JWT claim).

## What's unique about this platform

1. **Tenant-aware:** every operation runs against one tenant's data and configuration.
2. **Plugin layer:** non-essential features (coupons, reviews, marketing, analytics, loyalty, etc.) can be enabled per tenant without redeployment.
3. **Feature flags:** within each enabled plugin, individual sub-features can be toggled in real time.

If you only manage one shop, you can ignore the multi-tenant controls — your shop is just the default tenant.

## How to navigate this section

- **Operations** — daily tasks: dashboard, products, categories, orders, customers.
- **Multi-Tenant Control** — tenant management, plugin enablement, feature flag toggling.
- **Plugin Management** — per-plugin admin operations (creating coupon campaigns, moderating reviews, etc.).

## Quick links

- [Reading the dashboard](./dashboard)
- [Managing tenants](./tenants)
- [Enabling a plugin](./plugins)
- [Toggling a feature flag](./feature-flags)
