# Authorization (RBAC & Dynamic Permissions)

Authorization has three layers, applied cheapest-first:

```
JwtAuthGuard            → who are you? (decode + active-user check)
  RolesGuard            → static @Roles() gate (super_admin always passes)
  TenantScopeGuard      → pin the request to your tenant (zero I/O)
  DynamicPermissionGuard→ opt-in @RequirePermission policy (Redis → Mongo)
  Feature-flag guards   → plugin/flag gating for [Plugin] routes
```

## Roles

The access JWT carries `{ sub, email, role, tenantId }`.

| Role           | `tenantId`  | Can provision admins | Manage permissions | Bypasses feature gate |
| -------------- | ----------- | -------------------- | ------------------ | --------------------- |
| `super_admin`  | `null`      | ✅                   | ✅ global          | ✅                    |
| `tenant_admin` | tenant's id | ❌                   | ✅ own tenant      | ❌                    |
| `tenant_staff` | tenant's id | ❌                   | ❌                 | ❌                    |
| `end_user`     | tenant's id | ❌                   | ❌                 | ❌                    |

The canonical enum lives in `src/common/enums/role.enum.ts`.

## Super admin (god mode)

A single platform-level user with `tenantId: null` that bypasses tenant scope,
role checks, and feature gates.

- **Bootstrap:** on first startup `BootstrapService` reads `SUPER_ADMIN_EMAIL` /
  `SUPER_ADMIN_PASSWORD` and creates it if none exists (idempotent — never
  duplicates or throws).
- **CLI:** `npm run cli bootstrap:superadmin [email] [password]`.
- **Provision a tenant admin:** `POST /admin/tenants/:tenantId/provision-admin`
  (super admin only) creates the first `tenant_admin` for a tenant and emails a
  password-set code. The invitee activates via `POST /auth/reset-password`.

## Tenant binding

Every authenticated non-super user is pinned to their own tenant. The
`TenantScopeGuard` rejects requests whose resolved tenant differs from the
token's `tenantId` and overwrites the request tenant with the token value, so
the `X-Tenant-ID` header cannot be used to cross tenants. The super admin is
unscoped and may target any tenant.

## Static RBAC

`@Roles(Role.TENANT_ADMIN, Role.TENANT_STAFF)` + `RolesGuard` compares the JWT
`role` against the required list. `super_admin` always passes. Routes without
`@Roles` allow any authenticated user; `@Public()` skips auth entirely.

## Dynamic permission policies

For fine-grained, runtime-editable control, opt a route in with
`@RequirePermission('<apiKey>')`:

```typescript
@RequirePermission('products:create')
@Post()
create(@Body() dto: CreateProductDto) { /* ... */ }
```

### Data model — `permissions` collection

```
{ tenantId: string | null, role: Role, apiKey: string, effect: 'allow' | 'deny' }
```

`tenantId: null` is a platform-wide rule (super admin only). The unique index is
`{ tenantId, role, apiKey }`.

### Resolution

For a request, the guard resolves `(tenantId, role, apiKey)`:

1. **Explicit deny** wins.
2. then **explicit allow**.
3. else **default deny**.

Platform-wide (`null`) and tenant-specific rules are merged with deny precedence.
`super_admin` is allowed without any lookup.

### Performance

The resolved policy set for each `(tenantId, role)` is cached in Redis as a flat
hash (`permissions:{tenant}:{role}`) so a guard check is O(1). TTL is
`PERMISSIONS_CACHE_TTL_SECONDS` (default 300s) and the relevant key is
invalidated immediately on any create/update/delete. If Redis is down the guard
falls back to MongoDB; if the policy store is unreachable it fails closed (deny).

### Endpoints

| Method | Path                  | Who                       | Purpose                                     |
| ------ | --------------------- | ------------------------- | ------------------------------------------- |
| GET    | `/admin/api-registry` | super admin, tenant admin | All endpoints + `apiKey`, grouped by module |
| GET    | `/permissions`        | super admin, tenant admin | List policies for the caller's scope        |
| POST   | `/permissions`        | super admin, tenant admin | Create an allow/deny rule                   |
| PATCH  | `/permissions/:id`    | super admin, tenant admin | Update a rule's effect                      |
| DELETE | `/permissions/:id`    | super admin, tenant admin | Remove a rule                               |

Tenant admins are scoped to their own tenant and cannot manage the `super_admin`
role, author platform-wide rules, or grant access to platform-management
endpoints (no privilege escalation beyond their own authority).

## Key files

| Concern                    | Path                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| Roles                      | `src/common/enums/role.enum.ts`                                      |
| Super admin bootstrap      | `src/modules/bootstrap/bootstrap.service.ts`                         |
| CLI                        | `src/cli/cli.ts`                                                     |
| Permission schema          | `src/modules/permissions/schemas/permission.schema.ts`               |
| Permission service + cache | `src/modules/permissions/permissions.service.ts`                     |
| `@RequirePermission`       | `src/modules/permissions/decorators/require-permission.decorator.ts` |
| Guards                     | `src/modules/permissions/guards/`                                    |
| Route registry             | `src/modules/permissions/routes-registry.service.ts`                 |
