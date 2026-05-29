# Authentication

The API uses a **dual-token** system: a short-lived access JWT in the response body, and a long-lived refresh token in an httpOnly cookie.

## Flow overview

```
  Frontend                                  API
  ────────                                  ───
  POST /auth/login  ──────────────────────►
    { email, password }
                                            ◄── 200
                                            Body:  { data: { accessToken } }
                                            Cookie: refresh_token=...; HttpOnly; Secure

  GET /products  ─────────────────────────►
    Authorization: Bearer <accessToken>
                                            ◄── 200  (or 401 if expired)

  POST /auth/refresh  ────────────────────►
    (cookie sent automatically)
                                            ◄── 200
                                            Body:  { data: { accessToken } }  (new token)
                                            Cookie: refresh_token=...; (rotated)

  POST /auth/logout  ─────────────────────►
                                            ◄── 200
                                            Cookie: refresh_token=; (cleared)
```

## Key rules

1. **Store the access token in memory** (a variable, React state, Zustand store) — never in `localStorage` or `sessionStorage` (XSS risk)
2. **Always send `credentials: 'include'`** on auth requests so the browser sends and receives the httpOnly cookie
3. **The access token expires in 15 minutes** — when you get a 401, call `/auth/refresh` to get a new one
4. **The refresh token is rotated** on every refresh — the old one is invalidated

## Register

```typescript
const res = await fetch('/api/v1/auth/register', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'MyStr0ng!Pass', // min 8 chars, 1 upper, 1 lower, 1 number, 1 symbol
    firstName: 'Ali',
    lastName: 'Panahi',
  }),
});

const { data } = await res.json();
// data.accessToken — store in memory
// refresh_token cookie is set automatically
```

## Login

```typescript
const res = await fetch('/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'MyStr0ng!Pass',
  }),
});

const { data } = await res.json();
// data.accessToken
// data.user — { _id, email, firstName, lastName, role }
```

## Making authenticated requests

```typescript
const res = await fetch('/api/v1/profile', {
  headers: { Authorization: `Bearer ${accessToken}` },
  credentials: 'include',
});
```

## Refreshing the token

When any request returns **401**, refresh the token and retry:

```typescript
async function refreshToken(): Promise<string | null> {
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include', // sends the refresh_token cookie
  });

  if (!res.ok) return null; // refresh failed — redirect to login

  const { data } = await res.json();
  return data.accessToken;
}
```

### Axios interceptor example

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

let accessToken = '';

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const res = await api.post('/auth/refresh');
      accessToken = res.data.data.accessToken;
      error.config.headers.Authorization = `Bearer ${accessToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  },
);
```

## Logout

```typescript
await fetch('/api/v1/auth/logout', {
  method: 'POST',
  credentials: 'include',
  headers: { Authorization: `Bearer ${accessToken}` },
});
// Clear accessToken from memory
accessToken = '';
```

## Logout from all devices

```typescript
await fetch('/api/v1/auth/logout-all', {
  method: 'POST',
  credentials: 'include',
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

## Roles

| Role     | Value      | Access                                    |
| -------- | ---------- | ----------------------------------------- |
| Customer | `customer` | Storefront, own profile, own orders       |
| Staff    | `staff`    | Admin panel (read-only on some resources) |
| Admin    | `admin`    | Full access                               |

The role is in the JWT payload and in `data.user.role` on login. Use it for UI-level access control (showing/hiding admin nav items, etc.). The API enforces role checks server-side regardless.

## Password requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character (`!@#$%^&*` etc.)

Show these rules in your registration/change-password forms.
