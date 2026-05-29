# Connecting to the API

## Base URL

All endpoints live under a single prefix:

```
https://<backend-domain>/api/v1
```

For local development (backend running on your machine or a teammate's):

```
http://localhost:3000/api/v1
```

## CORS — what you need from the backend team

Before your frontend can make requests, your origin must be in the backend's `CORS_ORIGINS` list. Ask the backend team to add it.

| Your environment            | Origin to add                                      |
| --------------------------- | -------------------------------------------------- |
| Next.js dev (`npm run dev`) | `http://localhost:3000` or `http://localhost:3001` |
| Vite dev (React/Vue/Svelte) | `http://localhost:5173`                            |
| Angular dev                 | `http://localhost:4200`                            |
| Deployed frontend           | `https://your-frontend-domain.com`                 |

> [!NOTE]
> You don't configure anything on your side for CORS — it's entirely a backend setting. If you see `CORS policy` errors in the browser console, the fix is always on the backend: add your origin to `CORS_ORIGINS` and restart.

## Request headers

| Header            | When to send                          | Example                   |
| ----------------- | ------------------------------------- | ------------------------- |
| `Content-Type`    | Every POST/PATCH/PUT with a body      | `application/json`        |
| `Authorization`   | Every request to a protected endpoint | `Bearer eyJhbG...`        |
| `X-Tenant-ID`     | When targeting a specific tenant      | `acme-corp`               |
| `x-lang`          | When requesting a specific language   | `fa` or `en`              |
| `Accept-Language` | Alternative to `x-lang`               | `fa-IR,fa;q=0.9,en;q=0.8` |

If you don't send `X-Tenant-ID`, the API defaults to the `default` tenant. If you don't send a language header, the API responds in English.

## Response format

Every response follows the same envelope — **you never have to guess the shape**.

### Success (2xx)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "totalDocs": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "timestamp": "2026-05-27T12:00:00.000Z"
}
```

- `data` — the actual payload (object, array, or primitive)
- `meta` — only present on paginated list endpoints

### Error (4xx / 5xx)

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "email must be a valid email" }],
  "timestamp": "2026-05-27T12:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

- `errors[]` — present on validation failures (400). Each entry has `field` and `message`.
- `message` — a human-readable string (may be an i18n key like `auth.invalid_credentials`)

### TypeScript types

```typescript
interface ApiSuccess<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  errors?: { field: string; message: string }[];
  timestamp: string;
  path: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

## Pagination

List endpoints accept these query parameters:

| Param   | Type   | Default      | Description                           |
| ------- | ------ | ------------ | ------------------------------------- |
| `page`  | number | `1`          | Page number (1-based)                 |
| `limit` | number | `10`         | Items per page                        |
| `sort`  | string | `-createdAt` | Sort field. Prefix `-` for descending |

Example:

```
GET /api/v1/products?page=2&limit=20&sort=-price
```

## Error handling pattern

```typescript
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const body: ApiResponse<T> = await res.json();

  if (!body.success) {
    throw body; // or handle body.errors for form validation
  }

  return body.data;
}
```

## Health check

To verify the API is reachable:

```typescript
const res = await fetch('https://YOUR-API/api/v1/health/liveness');
// 200 → API is up
// Network error → API is down
```
