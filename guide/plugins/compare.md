# Compare Products

Add up to four products to a side-by-side comparison list. The list is stored against your session (cookie `compare_session`) and survives for one hour.

## Add a product

```bash
curl -X POST http://localhost:3000/api/v1/compare/<productId> \
  -b cookies.txt -c cookies.txt
```

On the first call the server sets a `compare_session` cookie. Reuse it on every subsequent call.

> [!NOTE]
> Maximum 4 products. A 5th `POST` returns `400 compare.max_items_reached:4`.

## See the current list

```bash
curl http://localhost:3000/api/v1/compare -b cookies.txt
```

Returns the array of product ids currently in your comparison.

## Remove one

```bash
curl -X DELETE http://localhost:3000/api/v1/compare/<productId> -b cookies.txt
```

## Clear the list

```bash
curl -X DELETE http://localhost:3000/api/v1/compare -b cookies.txt
```

## Get the side-by-side comparison

```bash
curl http://localhost:3000/api/v1/compare/result -b cookies.txt
```

Returns each product with its `images`, `variants`, and a `attributes` map normalized across all compared products — every product carries every key (with `null` where it doesn't apply) so a UI can render a clean table.

A `warnings` array contains `compare.cross_category_warning` when the comparison spans multiple categories.

> [!WARNING]
> You need at least 2 products in the list to call `/result`. Otherwise you get `400 compare.need_at_least_two`.

## Attributes-only result (when enabled)

If the shop has `compareAttributes: true`:

```bash
curl http://localhost:3000/api/v1/compare/result/attributes -b cookies.txt
```

Returns a slimmer payload — only the attribute table, no images or variants.

## FAQ

**Why does the list disappear?**
The session expires after one hour of inactivity. Re-add the products.

**Can I share a comparison link?**
Not yet — comparisons are per-session and not exposed via a shareable URL.

**Does the comparison work when I'm logged out?**
Yes. The cookie is independent of authentication.
