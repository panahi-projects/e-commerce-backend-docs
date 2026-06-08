# Audit Logs (Developer)

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Plugin key      | `auditLogs`                                                           |
| Module class    | `AuditLogsPlugin` in `src/plugins/audit-logs/audit-logs.plugin.ts`    |
| Controller path | `/api/v1/audit-logs`                                                  |
| Storage         | MongoDB `audit_logs` (TTL retention)                                  |
| Depends on      | (none) — listens to the `security.audit` event from core             |

A per-tenant **security/audit trail**: logins, failed logins, logouts, password set/change/reset, and role changes. Built for security investigations and compliance.

## Enable / disable behaviour (billing)

This is a paid, per-tenant plugin. The gating matches "pay to use, keep your data if you stop":

- **Write path** — the listener persists an event **only if** `FeatureFlagService.isPluginEnabled(tenantId, 'auditLogs')`. Disable it for a tenant → capture stops immediately.
- **Read path** — `GET /audit-logs` is `@RequiresPlugin('auditLogs')` → `403` when disabled.
- **Data on disable** — nothing is deleted. Existing rows remain (until the TTL window) and become readable again the moment the plugin is re-enabled.

The super admin toggles it per tenant: `PATCH /admin/tenants/:tenantId/plugins/auditLogs/enable | disable`.

## How capture works (decoupled)

Core stays decoupled from the plugin via a shared event contract in `@common/audit`:

```
AuthService / UsersService ──emit──▶ "security.audit" (SecurityAuditEvent)
                                          │
                         AuditLogsService.handleSecurityEvent (@OnEvent)
                                          │  isPluginEnabled(tenant)?
                                          ▼
                                    Mongo audit_logs
```

Core always emits the event; the plugin decides whether to store it. Request context (IP, user-agent) is threaded from the auth controller into the service via an `AuditContext` so it can be recorded. Events are fire-and-forget — a capture failure never breaks the originating request.

Captured actions (`SecurityAuditAction`): `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `LOGOUT_ALL`, `PASSWORD_SET`, `PASSWORD_CHANGED`, `PASSWORD_RESET`, `ROLE_CHANGED`, `SUSPICIOUS`.

## Document shape

```json
{
  "_id": "…",
  "tenantId": "acme",
  "userId": "665f…",
  "identifier": "09120000000",
  "action": "LOGIN",
  "ip": "192.168.1.1",
  "userAgent": "Chrome …",
  "meta": { "from": "end_user", "to": "tenant_staff" },
  "createdAt": "2026-06-08T…"
}
```

## Retention (TTL)

A TTL index on `createdAt` purges entries older than `AUDIT_LOG_RETENTION_DAYS` (default **90**). It's read when the schema loads, so **changing it requires rebuilding the TTL index** (drop + recreate, or `collMod`) — a plain redeploy won't change an existing TTL.

## Endpoint

| Method | Path          | Auth                         | Notes                                                     |
| ------ | ------------- | ---------------------------- | --------------------------------------------------------- |
| `GET`  | `/audit-logs` | admin / staff (super admin)  | Paginated; filter `userId`, `action`, `from`, `to` (ISO). |

## Not in scope: application logs

This plugin is for **security/audit events** only. Operational application logs — request received, service started, cache miss, validation errors, internal exceptions — are **not** stored in MongoDB. They go to **stdout** via the NestJS logger (and the `LoggingInterceptor` for request timing), where Docker/host log drivers collect them for aggregation (Loki, ELK, etc.). Keep these two streams separate: audit = compliance/security in Mongo; app logs = ops in stdout.