# Customers

Manage user accounts — search, edit, activate/deactivate, soft-delete.

## Endpoints

| Method   | Path                         | Role        | Purpose                          |
| -------- | ---------------------------- | ----------- | -------------------------------- |
| `GET`    | `/api/v1/users`              | ADMIN/STAFF | List users (paginated, filtered) |
| `GET`    | `/api/v1/users/:id`          | ADMIN/STAFF | One user                         |
| `PATCH`  | `/api/v1/users/:id`          | ADMIN/STAFF | Update profile fields            |
| `PATCH`  | `/api/v1/users/:id/activate` | ADMIN/STAFF | Toggle `isActive`                |
| `DELETE` | `/api/v1/users/:id`          | ADMIN/STAFF | Soft-delete                      |

## Listing with filters

```bash
curl 'http://localhost:3000/api/v1/users?role=CUSTOMER&isActive=true&q=jane' \
  -H 'Authorization: Bearer <admin-token>'
```

Supports pagination (`page`, `limit`) and a free-text `q` over `email`, `firstName`, `lastName`.

## Deactivating an account

```bash
curl -X PATCH http://localhost:3000/api/v1/users/<userId>/activate \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "isActive": false }'
```

Deactivated users cannot log in (the JWT strategy refuses them) but their data and order history are preserved.

## Soft-delete

```bash
curl -X DELETE http://localhost:3000/api/v1/users/<userId> \
  -H 'Authorization: Bearer <admin-token>'
```

Marks `isDeleted: true` and sets `deletedAt`. The record stays in MongoDB but is excluded from every listing.

## Business rules

- Emails are unique per tenant and stored lowercase.
- A deleted user's loyalty account remains so the audit trail (refund credits, etc.) survives.
- Cart/order history is not deleted by the soft-delete — it is the data of record.
