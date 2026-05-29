# Coupons (Developer)

| Field           | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Plugin key      | `coupons`                                                  |
| Module class    | `CouponsPlugin` in `src/plugins/coupons/coupons.plugin.ts` |
| Controller path | `/api/v1/coupons`                                          |
| Mongo schema    | `coupons` (`src/plugins/coupons/schemas/coupon.schema.ts`) |
| Depends on      | (none)                                                     |
| Listens to      | (none)                                                     |
| Emits           | (none)                                                     |

## Flags

| Flag                  | Default | What it does                                             |
| --------------------- | ------- | -------------------------------------------------------- |
| `percentageCoupons`   | `true`  | Allow validating percentage-type coupons                 |
| `fixedCoupons`        | `true`  | Allow validating fixed-amount coupons                    |
| `freeShippingCoupons` | `true`  | Allow free-shipping coupons + the `/free-shipping` route |
| `perUserLimit`        | `false` | (Reserved — per-user usage cap enforcement)              |

## Endpoints

| Method   | Path                     | Auth        | Gating                                                     |
| -------- | ------------------------ | ----------- | ---------------------------------------------------------- |
| `POST`   | `/coupons/validate`      | Public      | `@RequiresPlugin('coupons')` + runtime flag by coupon type |
| `GET`    | `/coupons/free-shipping` | Public      | `@FeatureFlag('coupons', 'freeShippingCoupons')`           |
| `GET`    | `/coupons`               | ADMIN/STAFF | `@RequiresPlugin('coupons')`                               |
| `POST`   | `/coupons`               | ADMIN       | `@RequiresPlugin('coupons')`                               |
| `PATCH`  | `/coupons/:id`           | ADMIN       | `@RequiresPlugin('coupons')`                               |
| `DELETE` | `/coupons/:id`           | ADMIN       | `@RequiresPlugin('coupons')`                               |

## Runtime flag dispatch on `/validate`

```typescript
const FLAG_FOR_TYPE: Record<CouponType, string> = {
  percentage: 'percentageCoupons',
  fixed: 'fixedCoupons',
  'free-shipping': 'freeShippingCoupons',
};

const result = await this.coupons.validate(dto);
const allowed = await this.featureFlags.isFlagEnabled(
  tenantId,
  'coupons',
  FLAG_FOR_TYPE[result.type],
);
if (!allowed) throw new ForbiddenException(/* … */);
```

A static `@FeatureFlag` doesn't fit because the type is only known after the DB lookup.

## Integration with core

`CartService.applyCoupon` and `CheckoutService.initiate` use `@Optional() coupons?: CouponsService`. When the plugin isn't loaded, `applyCoupon` throws `400 cart.coupons_plugin_disabled` and checkout fails closed if a cart already has a `couponCode`.

## Tests

`src/plugins/coupons/coupons.service.spec.ts` — happy path, expired, usage-exhausted, min-order-not-met, free-shipping returns `freeShipping: true`. Coverage thresholds in `jest.config.ts` ≥ 80% per file.
