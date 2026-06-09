# Frontend Integration Guide

This section is for **frontend developers** building apps (admin panel, storefront, mobile) that consume this API. You don't need to understand the backend internals — just how to talk to it.

## Before you start

1. Get the **API base URL** from your backend team (e.g. `{base-url}/api/v1`)
2. Ask them to add your dev/production origin to `CORS_ORIGINS` on the server
3. Open the [Swagger UI]({base-url}/api/v1/docs) to explore all endpoints interactively

## Sections

| Page                                     | What you'll learn                                  |
| ---------------------------------------- | -------------------------------------------------- |
| [Connecting to the API](./connecting)    | Base URL, headers, response format, error handling |
| [Authentication](./authentication)       | Register, login, refresh tokens, logout            |
| [Multi-Tenant](./multi-tenant)           | How to send the tenant identifier                  |
| [Generating an API Client](./api-client) | Auto-generate a typed client from the OpenAPI spec |

## Quick start (30 seconds)

```typescript
// 1. Login (identifier = email or mobile; seed admin has a password)
const res = await fetch('https://YOUR-API/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // sends & receives cookies (refresh token)
  body: JSON.stringify({ identifier: 'alice@admin.com', password: 'Test@1234' }),
});
const { data } = await res.json();
const token = data.accessToken;

// 2. Call any protected endpoint
const products = await fetch('https://YOUR-API/api/v1/products', {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: productList, meta } = await products.json();
```

That's it. The rest of this section covers the details.
