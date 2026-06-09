# Customers

Manage user accounts — search, edit, activate/deactivate, soft-delete.

## Endpoints

| Method   | Path                         | Role               | Purpose                          |
| -------- | ---------------------------- | ------------------ | -------------------------------- |
| `GET`    | `/api/v1/users`              | tenant_admin/staff | List users (paginated, filtered) |
| `GET`    | `/api/v1/users/:id`          | tenant_admin/staff | One user                         |
| `PATCH`  | `/api/v1/users/:id`          | tenant_admin/staff | Update profile fields (incl. `role`) |
| `PATCH`  | `/api/v1/users/:id/activate` | tenant_admin/staff | Toggle `isActive`                |
| `DELETE` | `/api/v1/users/:id`          | tenant_admin/staff | Soft-delete                      |

## Hierarchy + tenant scoping

User management is both **tenant-scoped** and **hierarchy-scoped**. On every `/users` endpoint a caller sees and manages only accounts **in their own tenant** whose role is **strictly below their own**:

- `tenant_admin` sees `tenant_staff` and `end_user` (not peer admins).
- `tenant_staff` sees only `end_user`.
- `super_admin` sees and manages everything across all tenants.

Targets outside that scope return `404` (they are invisible, not merely forbidden). A non-super-admin can never assign a role at or above their own — attempting it returns `403 users.role_escalation_forbidden`. Rank order: `super_admin > tenant_admin > tenant_staff > end_user`.

## Listing with filters

```bash
curl 'http://localhost:3000/api/v1/users?role=end_user&isActive=true&q=jane' \
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
