# Authentication

This page explains how to sign up, log in, and recover access.

## Account types

| Account type   | Who                                                             |
| -------------- | --------------------------------------------------------------- |
| `end_user`     | Default for everyone who registers via the storefront           |
| `tenant_staff` | Created by an admin (you cannot self-register as staff)         |
| `tenant_admin` | Created by another admin                                        |

## Registering

Authentication is **OTP-first / passwordless**. You register with just an `identifier` — either an email address or an Iranian mobile number (auto-detected). No name or password is required at sign-up.

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{ "identifier": "you@example.com" }'
```

This sends a one-time code (OTP) to your email or phone. The response contains **no tokens** — you are not logged in yet. (If the account already exists you get `409`.) Submit the code to `POST /auth/verify-otp` to complete registration and get your tokens (see below).

> [!NOTE]
> A password is **optional** — you can shop entirely with OTP. If you later set one (`POST /auth/set-password`), it must contain at least 8 characters, including at least one uppercase letter, one number, and one special character. Same rules as the password reset flow below.

## Logging in

You can log in with OTP only, password only, or both (the second factor when 2FA is on). The login identifier field is always `identifier` (email **or** mobile).

```bash
# Password login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{ "identifier": "you@example.com", "password": "Strong@1234" }'

# OTP-only login (request a code first, see below)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{ "identifier": "you@example.com", "code": "123456" }'
```

The `-c cookies.txt` switch captures the `refresh_token` cookie. Use `-b cookies.txt` on subsequent calls to keep the session.

## Renewing the access token

Access tokens expire after 15 minutes. Use the refresh cookie to get a new one without re-entering the password:

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh -b cookies.txt
```

## Logging out

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout -b cookies.txt
```

The refresh token is revoked server-side and the cookie is cleared.

## OTP: requesting and verifying a code

After registration the server sends a one-time code to your email or phone. You can request a fresh one any time.

```bash
# Request a new code
curl -X POST http://localhost:3000/api/v1/auth/request-otp \
  -H 'Content-Type: application/json' \
  -d '{ "identifier": "you@example.com" }'

# Submit the code — completes registration or logs you in
curl -X POST http://localhost:3000/api/v1/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{ "identifier": "you@example.com", "code": "123456" }'
```

`verify-otp` returns `{ user, accessToken }` and sets the `refresh_token` cookie — you are now logged in. After successful verification, `isEmailVerified` (or `isPhoneVerified`) flips to `true` on your profile.

## Forgot password

```bash
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{ "identifier": "you@example.com" }'
```

The server sends you a one-time code. Submit it with your new password:

```bash
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{ "identifier": "you@example.com", "code": "123456", "newPassword": "Brand@New1" }'
```

> [!NOTE]
> If you have never set a password, use `POST /auth/set-password` with `{ "newPassword": "..." }` (Bearer token) the first time instead.

## Changing your password while logged in

```bash
curl -X POST http://localhost:3000/api/v1/auth/change-password \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "currentPassword": "Old@1234", "newPassword": "New@1234" }'
```

> [!WARNING]
> Changing your password revokes all existing refresh tokens. You will need to log in again on all your other devices.

## FAQ

**Why does the access token expire so quickly?**
Short-lived access tokens limit damage if a token is leaked. The refresh token in the cookie keeps you logged in for 7 days.

**I lost access to the email I registered with.**
Contact the shop operator — only an admin can change the email on your account.

**My OTP code says "expired".**
Codes expire after 10 minutes (the default `OTP_TTL_MINUTES`). Request a new one.

**I get `429 Too Many Requests` on login.**
The auth throttle limits failed attempts. Wait 60 seconds and try again.
