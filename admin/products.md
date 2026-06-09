# Products

Manage the catalogue — products, variants, and stock.

## Endpoints

| Method   | Path                              | Role               | Purpose                         |
| -------- | --------------------------------- | ------------------ | ------------------------------- |
| `GET`    | `/api/v1/products`                | Any                | Public listing (published only) |
| `GET`    | `/api/v1/products/featured`       | Any                | Featured products               |
| `GET`    | `/api/v1/products/:slug`          | Any                | Public detail (by slug)         |
| `GET`    | `/api/v1/products/admin/list`     | tenant_admin/staff | Admin listing (incl. drafts/archived) |
| `POST`   | `/api/v1/products`                | tenant_admin/staff | Create                          |
| `PATCH`  | `/api/v1/products/:id`            | tenant_admin/staff | Update                          |
| `PATCH`  | `/api/v1/products/:id/status`     | tenant_admin/staff | Change status                   |
| `DELETE` | `/api/v1/products/:id`            | tenant_admin       | Soft-delete                     |

## Creating a product

```bash
curl -X POST http://localhost:3000/api/v1/products \
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
curl -X PATCH http://localhost:3000/api/v1/inventory/65.../adjust \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "sku": "WH-BLK", "delta": 30, "reason": "restock" }'
```

Other inventory endpoints (tenant_admin/staff): `GET /inventory`, `GET /inventory/alerts/low-stock`, `GET /inventory/:productId`.

A `delta` of `30` adds 30 units; `-5` subtracts. The change records a `stockHistory` entry.

## Business rules

- `slug` is unique per tenant.
- `status` can be `draft` (hidden), `published` (visible), or `archived` (hidden but kept for order history).
- Low stock emits `product.low-stock` events (consumed by Inventory for alerts).
- A variant's `attributes` keys are free-form (`color`, `size`, etc.). The compare plugin normalizes these across products.
