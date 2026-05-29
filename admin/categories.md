# Categories

Categories are an arbitrary-depth tree. Each node has an i18n name and an optional `parent`.

## Endpoints

| Method   | Path                           | Role  | Purpose                         |
| -------- | ------------------------------ | ----- | ------------------------------- |
| `GET`    | `/api/v1/categories`           | Any   | Flat list                       |
| `GET`    | `/api/v1/categories/tree`      | Any   | Tree                            |
| `POST`   | `/api/v1/admin/categories`     | ADMIN | Create                          |
| `PATCH`  | `/api/v1/admin/categories/:id` | ADMIN | Rename / re-parent              |
| `DELETE` | `/api/v1/admin/categories/:id` | ADMIN | Delete (children must be empty) |

## Creating a child category

```bash
curl -X POST http://localhost:3000/api/v1/admin/categories \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": { "en": "Headphones", "fa": "هدفون" },
    "slug": "headphones",
    "parent": "65..."
  }'
```

## Business rules

- Slugs are unique per tenant.
- Deleting a category fails if products still reference it. Re-parent products first.
- The tree endpoint is the canonical input for storefront nav menus.
