# Categories

Categories are an arbitrary-depth tree. Each node has an i18n name and an optional `parent`.

## Endpoints

| Method   | Path                          | Role                      | Purpose                         |
| -------- | ----------------------------- | ------------------------- | ------------------------------- |
| `GET`    | `/api/v1/categories`          | Any                       | Flat list                       |
| `GET`    | `/api/v1/categories/tree`     | Any                       | Tree                            |
| `GET`    | `/api/v1/categories/:slug`    | Any                       | Single category by slug         |
| `POST`   | `/api/v1/categories`          | tenant_admin/staff        | Create                          |
| `PATCH`  | `/api/v1/categories/:id`      | tenant_admin/staff        | Rename / re-parent              |
| `DELETE` | `/api/v1/categories/:id`      | tenant_admin              | Delete (children must be empty) |

## Creating a child category

```bash
curl -X POST http://localhost:3000/api/v1/categories \
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
