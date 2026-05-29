# Multi-Tenant Requests

The API serves multiple tenants (shops/customers) from a single deployment. Each tenant can have different plugins and feature flags enabled.

## How tenant is resolved

The API resolves the tenant for each request in this priority:

1. **Subdomain** — `acme.yoursaas.com` resolves to tenant `acme`
2. **`X-Tenant-ID` header** — explicitly set per request
3. **JWT `tenantId` claim** — extracted from the access token
4. **Fallback** — defaults to `default`

## For most frontends

If your frontend serves a single tenant, set the header globally:

```typescript
// Axios
const api = axios.create({
  baseURL: 'https://api.example.com/api/v1',
  withCredentials: true,
  headers: { 'X-Tenant-ID': 'acme-corp' },
});

// Fetch wrapper
function apiFetch(path: string, options?: RequestInit) {
  return fetch(`https://api.example.com/api/v1${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'X-Tenant-ID': 'acme-corp',
      ...options?.headers,
    },
  });
}
```

## For multi-tenant admin panels

If your admin panel manages multiple tenants, pass the tenant ID dynamically:

```typescript
async function fetchTenantProducts(tenantId: string) {
  return api.get('/products', {
    headers: { 'X-Tenant-ID': tenantId },
  });
}
```

## What happens when a plugin is disabled

If you call an endpoint for a plugin that the tenant hasn't enabled, you'll get:

```json
{
  "success": false,
  "statusCode": 403,
  "message": "Plugin 'coupons' is not enabled for this tenant"
}
```

Handle this in your UI by hiding features that aren't available for the current tenant. You can check which plugins are enabled via the admin endpoint:

```
GET /api/v1/admin/tenants/{tenantId}/plugins
```

## Language / i18n

Send the user's preferred language via header:

```typescript
headers: {
  'x-lang': 'fa',       // or 'en'
  // OR use the standard header:
  'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
}
```

Error messages and certain response fields will be returned in the requested language. The API supports `en` (English) and `fa` (Farsi).
