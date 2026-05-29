# Authentication

This page explains how to sign up, log in, and recover access.

## Account types

| Account type | Who                                                     |
| ------------ | ------------------------------------------------------- |
| Customer     | Default for everyone who registers via the storefront   |
| Staff        | Created by an admin (you cannot self-register as staff) |
| Admin        | Created by another admin                                |

## Registering

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "you@example.com",
    "password": "Strong@1234",
    "firstName": "Jane",
    "lastName": "Doe"
  }'
```

The response contains an access token (short-lived JWT) and sets a `refresh_token` cookie (httpOnly, signed). You are now logged in.

> [!NOTE]
> Passwords must contain at least 8 characters, including a number and a special character. Same rules as the password reset flow below.

## Logging in

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{ "email": "you@example.com", "password": "Strong@1234" }'
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

## Verifying your email (OTP)

After registration the server sends a one-time code by email.

```bash
# Request a new code
curl -X POST http://localhost:3000/api/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{ "email": "you@example.com" }'

# Submit the code
curl -X POST http://localhost:3000/api/v1/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{ "email": "you@example.com", "code": "123456" }'
```

After successful verification, `isEmailVerified` flips to `true` on your profile.

## Forgot password

```bash
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{ "email": "you@example.com" }'
```

The server emails you a reset link with a one-time token. Submit the new password:

```bash
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H 'Content-Type: application/json' \
  -d '{ "token": "<from-email>", "password": "Brand@New1" }'
```

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
