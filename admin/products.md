# Products

Manage the catalogue — products, variants, and stock.

## Endpoints

| Method   | Path                                       | Role        | Purpose                         |
| -------- | ------------------------------------------ | ----------- | ------------------------------- |
| `GET`    | `/api/v1/products`                         | Any         | Public listing (published only) |
| `GET`    | `/api/v1/products/:id`                     | Any         | Public detail                   |
| `GET`    | `/api/v1/admin/products`                   | ADMIN/STAFF | Admin listing (all statuses)    |
| `POST`   | `/api/v1/admin/products`                   | ADMIN/STAFF | Create                          |
| `PATCH`  | `/api/v1/admin/products/:id`               | ADMIN/STAFF | Update                          |
| `DELETE` | `/api/v1/admin/products/:id`               | ADMIN       | Soft-delete                     |
| `PATCH`  | `/api/v1/admin/products/:id/variants/:sku` | ADMIN/STAFF | Update one variant              |

## Creating a product

```bash
curl -X POST http://localhost:3000/api/v1/admin/products \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": { "en": "Wireless Headphones", "fa": "هدفون بی‌سیم" },
    "slug": "wireless-headphones",
    "description": { "en": "Active noise cancellation, 30h battery." },
    "categoryId": "65...",
    "images": ["/uploads/wh-1.jpg"],
    "basePrice": 199.00,
    "variants": [
      { "sku": "WH-BLK", "price": 199.00, "stock": 50, "attributes": { "color": "black" } },
      { "sku": "WH-WHT", "price": 199.00, "stock": 25, "attributes": { "color": "white" } }
    ],
    "status": "published"
  }'
```

## Stock adjustment

Inventory changes flow through the inventory module (event-driven so changes are auditable):

```bash
curl -X POST http://localhost:3000/api/v1/admin/inventory/adjust \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "productId": "65...", "sku": "WH-BLK", "delta": 30, "reason": "restock" }'
```

A `delta` of `30` adds 30 units; `-5` subtracts. The change records a `stockHistory` entry.

## Business rules

- `slug` is unique per tenant.
- `status` can be `draft` (hidden), `published` (visible), or `archived` (hidden but kept for order history).
- Low stock emits `product.low-stock` events (consumed by Inventory for alerts).
- A variant's `attributes` keys are free-form (`color`, `size`, etc.). The compare plugin normalizes these across products.
