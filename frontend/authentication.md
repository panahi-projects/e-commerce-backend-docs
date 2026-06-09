# Authentication

The API is **OTP-first / passwordless**. Accounts are created with a single
**identifier** (email *or* mobile number) and verified with a one-time code — a
password is **optional** and opt-in. Sessions use a **dual-token** system: a
short-lived access JWT in the response body, and a long-lived refresh token in an
httpOnly cookie.

There are three ways to log in, all via `POST /auth/login`:

- **OTP only** — `{ identifier, code }` (request the code first via `/auth/request-otp`). Works for any account.
- **Password only** — `{ identifier, password }` (only accounts that have set a password).
- **Two-factor** — `{ identifier, password, code }` (required when the account enabled 2FA).

## Flow overview

```
  Frontend                                  API
  ────────                                  ───
  POST /auth/register ────────────────────►
    { identifier }                           ◄── 200  (OTP sent — no tokens yet)

  POST /auth/verify-otp ──────────────────►
    { identifier, code }
                                            ◄── 200
                                            Body:  { data: { user, accessToken } }
                                            Cookie: refresh_token=...; HttpOnly; Secure

  POST /auth/login  ──────────────────────►
    { identifier, password? , code? }
                                            ◄── 200
                                            Body:  { data: { user, accessToken } }
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
3. **The access token is short-lived** (default 15 minutes) — when you get a 401, call `/auth/refresh` to get a new one
4. **The refresh token is rotated** on every refresh — the old one is invalidated

## Register (OTP-first)

Registration takes only an **identifier** (email or mobile, auto-detected). No
name or password. The account is created passwordless and an OTP is sent over the
matching channel — **no tokens are returned yet**.

```typescript
// Step 1 — request the account + OTP
await fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'user@example.com' }), // or '09120000000'
});
// → 200 { data: { identifier, channel, delivery } }  — 409 if it already exists

// Step 2 — verify the OTP to complete registration and get tokens
const res = await fetch('/api/v1/auth/verify-otp', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'user@example.com', code: '123456' }),
});

const { data } = await res.json();
// data.accessToken — store in memory; refresh_token cookie set automatically
// data.user — see shape below
```

Profile details (firstName, lastName, address) are filled later via the profile
endpoints — checkout enforces them before an order can be placed.

## Login

Supply an `identifier` plus **at least one** credential. Which mode runs depends
on what you send (password-only, OTP-only, or both for 2FA).

```typescript
// Password login (accounts that have set a password)
const res = await fetch('/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'user@example.com', password: 'MyStr0ng!Pass' }),
});

const { data } = await res.json();
// data.accessToken
// data.user — see shape below
```

```typescript
// OTP login (works for any account) — request the code first
await fetch('/api/v1/auth/request-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: '09120000000' }),
});
// then verify via /auth/verify-otp, or /auth/login with { identifier, code }
```

### `data.user` shape

```typescript
interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role: 'super_admin' | 'tenant_admin' | 'tenant_staff' | 'end_user';
  tenantId: string | null;
  firstName?: string;
  lastName?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  hasPassword: boolean;      // false = OTP-only account → offer "set password"
  twoFactorEnabled: boolean;
}
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

| Role         | Value          | `tenantId` | Access                                          |
| ------------ | -------------- | ---------- | ----------------------------------------------- |
| End user     | `end_user`     | tenant id  | Storefront, own profile, own orders             |
| Tenant staff | `tenant_staff` | tenant id  | Operational admin within one tenant             |
| Tenant admin | `tenant_admin` | tenant id  | Full admin of one tenant (incl. its staff)      |
| Super admin  | `super_admin`  | `null`     | Platform-wide; all tenants, bypasses all gates  |

The role is in the JWT payload and in `data.user.role` on login. Use it for
UI-level access control (showing/hiding admin nav items, etc.). The API enforces
role checks server-side regardless — and admin user lists are **hierarchy-scoped**
(a caller only sees users in their own tenant ranked strictly below themselves).

## Setting a password (optional)

Accounts start **passwordless**. Use `data.user.hasPassword` to decide what to offer:

- `hasPassword: false` → `POST /auth/set-password` `{ newPassword }` (authenticated, first time only).
- `hasPassword: true` → `POST /auth/change-password` `{ currentPassword, newPassword }`.
- Forgotten password → `POST /auth/forgot-password` `{ identifier }` then `POST /auth/reset-password` `{ identifier, code, newPassword }`.

### Password requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 number
- At least 1 special character (any non-alphanumeric, e.g. `!@#$%^&*`)

Show these rules in your set-password / change-password forms.
