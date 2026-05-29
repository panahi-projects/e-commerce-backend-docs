# Tenants

A tenant is one customer of the white-label platform — one shop. The tenant document holds the per-tenant plan, the list of enabled plugins, and the per-plugin feature flag map.

## Endpoints

All under `/api/v1/admin/tenants`, all require `ADMIN`.

| Method   | Path                                    | Purpose                                      |
| -------- | --------------------------------------- | -------------------------------------------- |
| `GET`    | `/`                                     | List tenants                                 |
| `POST`   | `/`                                     | Create a tenant                              |
| `GET`    | `/:tenantId`                            | Read tenant                                  |
| `GET`    | `/:tenantId/effective`                  | Plan defaults + overrides merged             |
| `GET`    | `/:tenantId/plugins`                    | Per-plugin status (enabled / loaded / flags) |
| `PATCH`  | `/:tenantId`                            | Update fields                                |
| `PATCH`  | `/:tenantId/plugins/:pluginKey/enable`  | Enable a plugin                              |
| `PATCH`  | `/:tenantId/plugins/:pluginKey/disable` | Disable a plugin                             |
| `PATCH`  | `/:tenantId/flags/:pluginKey`           | Update flags for a plugin                    |
| `DELETE` | `/:tenantId`                            | Soft-delete (set `isActive: false`)          |

## Creating a tenant

```bash
curl -X POST http://localhost:3000/api/v1/admin/tenants \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "tenantId": "acme-corp",
    "name": "ACME Corp",
    "contactEmail": "admin@acme.test",
    "plan": "growth",
    "enabledPlugins": ["coupons", "reviews", "marketing"]
  }'
```

`tenantId` is a slug (`[a-z0-9-]`) and must be unique. `plan` is `starter | growth | enterprise` — each plan has different defaults (see `src/modules/tenants/tenant-plan-defaults.ts`).

If `enabledPlugins` is omitted, the plan's defaults apply.

## Inspecting a tenant

```bash
curl http://localhost:3000/api/v1/admin/tenants/acme-corp \
  -H 'Authorization: Bearer <admin-token>'
```

For a richer view that merges plan defaults with tenant overrides:

```bash
curl http://localhost:3000/api/v1/admin/tenants/acme-corp/effective \
  -H 'Authorization: Bearer <admin-token>'
```

## Tenant identification on incoming requests

Every request resolves a tenantId before the controller runs. Priority order:

1. **Subdomain** (`acme.example.com` → `acme`)
2. **`X-Tenant-ID` header**
3. **`tenantId` JWT claim**
4. Fallback `default`

When testing, send `X-Tenant-ID: <slug>` on every request to act as that tenant.

## Soft-delete

```bash
curl -X DELETE http://localhost:3000/api/v1/admin/tenants/acme-corp \
  -H 'Authorization: Bearer <admin-token>'
```

Sets `isActive: false`. The `FeatureFlagService` returns "inactive" for an inactive tenant — every plugin and flag check fails closed, so the tenant's API surface is effectively shut off.

## Common workflow — onboarding a new customer

1. `POST /admin/tenants` with the right plan and the agreed plugin list.
2. (Optional) `PATCH /admin/tenants/:id/flags/<pluginKey>` to tweak any flag beyond the defaults.
3. Hand over the admin login (or invite a tenant admin user).
4. Done — no redeploy required, the tenant's API is live.
