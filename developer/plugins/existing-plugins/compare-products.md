# Compare Products (Developer)

| Field           | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Plugin key      | `compareProducts`                                                                    |
| Module class    | `CompareProductsPlugin` in `src/plugins/compare-products/compare-products.plugin.ts` |
| Controller path | `/api/v1/compare`                                                                    |
| Storage         | **Redis** — no Mongo schema. Key `compare:{sessionId}`, 1 h TTL                      |
| Depends on      | (none)                                                                               |

## Flags

| Flag                | Default | What it does                             |
| ------------------- | ------- | ---------------------------------------- |
| `compareAttributes` | `true`  | Enables `GET /compare/result/attributes` |
| `comparePricing`    | `true`  | Reserved (no separate endpoint today)    |
| `compareSideBySide` | `true`  | Enables `GET /compare/result`            |

## Endpoints

| Method   | Path                         | Auth   | Gating                                                 |
| -------- | ---------------------------- | ------ | ------------------------------------------------------ |
| `GET`    | `/compare`                   | Public | `@RequiresPlugin('compareProducts')`                   |
| `POST`   | `/compare/:productId`        | Public | `@RequiresPlugin('compareProducts')`                   |
| `DELETE` | `/compare/:productId`        | Public | `@RequiresPlugin('compareProducts')`                   |
| `DELETE` | `/compare`                   | Public | `@RequiresPlugin('compareProducts')`                   |
| `GET`    | `/compare/result`            | Public | `@FeatureFlag('compareProducts', 'compareSideBySide')` |
| `GET`    | `/compare/result/attributes` | Public | `@FeatureFlag('compareProducts', 'compareAttributes')` |

## Session resolution

`compare_session` is an httpOnly cookie set on the first request. The controller falls through to `randomUUID()` if not present and writes the cookie back. Same pattern as `CartController`.

## Redis schema

```
KEY:    compare:{sessionId}
VALUE:  JSON array of product ids — ['65aa...', '65ab...', ...]
TTL:    3600 s
```

Max 4 products. `add()` throws `400 compare.max_items_reached:4` on overflow.

## Result shape

```typescript
interface CompareResult {
  productIds: string[];
  products: Array<{ id; name; images; variants; attributes }>;
  attributeKeys: string[]; // union across all compared products
  warnings: string[]; // includes 'compare.cross_category_warning'
}
```

The `attributes` field on each product is normalized — every product has every key from `attributeKeys`, filled with `null` when missing. The frontend can iterate `attributeKeys` to render a clean comparison table.

## Cross-category warning

Triggered when `Set(product.categoryId.toString())` has size > 1. Pushed into the `warnings` array; the result is still returned.
