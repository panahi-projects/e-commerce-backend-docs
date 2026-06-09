# SMS

Generic, **multi-provider** SMS abstraction. Like payments, the rest of the app depends only on an interface — switching providers is an env change (`SMS_DEFAULT_PROVIDER`). Ships with sms.ir, Sabanovin, and Melipayamak implementations, plus a log fallback.

## The interface

```typescript
// src/modules/sms/sms-provider.interface.ts
export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SmsProvider {
  readonly name: string;
  sendOtp(mobile: string, code: string): Promise<SmsSendResult>;        // we pass the plaintext code
  sendText(mobiles: string[], text: string): Promise<SmsSendResult>;
  getCredit(): Promise<number>;
  getDeliveryStatus(id: string): Promise<SmsDeliveryStatus>;
}
```

The contract is **vendor-neutral**: `sendOtp` takes the code *we* generated, and each provider hides its own delivery mechanism (sms.ir template, Sabanovin `gateway=otp` text, Melipayamak shared pattern). `SmsService` injects the active provider via `@Inject(SMS_PROVIDER)`; `SmsModule.register()` (global, wired in `AppModule`) binds the config-selected provider at boot.

## Providers

| `SMS_PROVIDER` | Class | Auth | OTP mechanism |
| -------------- | ----- | ---- | ------------- |
| `smsir` | `SmsIrProvider` | `X-API-KEY` header | pre-approved template + `#CODE#` param |
| `sabanovin` | `SabanovinProvider` | API key in URL path | reserved `gateway=otp`, code in composed text |
| `melipayamak` | `MelipayamakProvider` | username/password in body | shared pattern (`bodyId`), code passed as arg |
| `log` | `LogSmsProvider` | — | default fallback; logs instead of sending |

All HTTP providers use native `fetch` (no extra dependency) via the shared `providers/sms-http.ts` helper (AbortController timeout + uniform transport-error → `503`). Credentials are never written to logs.

## Selecting the provider

Set **`SMS_DEFAULT_PROVIDER`** to one of `smsir` / `sabanovin` / `melipayamak` / `log`. Resolution order:

1. `SMS_DEFAULT_PROVIDER` (explicit).
2. `SMS_PROVIDER` — deprecated alias, still honored.
3. **Auto-detect** — the first provider whose credentials are configured ("live"), in priority order `smsir → sabanovin → melipayamak`. So a single configured account is used without naming it.
4. `log` fallback (no real send).

The chosen provider is logged at boot: `Active SMS provider: <name>`.

## Configuration

Shared: `SMS_DEFAULT_PROVIDER`, `SMS_TIMEOUT_MS` (default `10000`).

| Provider | Env vars |
| -------- | -------- |
| sms.ir | `SMSIR_BASE_URL`, `SMSIR_API_KEY`, `SMSIR_LINE_NUMBER`, `SMSIR_OTP_TEMPLATE_ID`, `SMSIR_OTP_PARAMETER_NAME`, `SMSIR_SANDBOX` |
| Sabanovin | `SABANOVIN_BASE_URL`, `SABANOVIN_API_KEY`, `SABANOVIN_LINE_NUMBER`, `SABANOVIN_OTP_TEXT` (`{code}` placeholder) |
| Melipayamak | `MELIPAYAMAK_BASE_URL`, `MELIPAYAMAK_USERNAME`, `MELIPAYAMAK_PASSWORD`, `MELIPAYAMAK_FROM`, `MELIPAYAMAK_OTP_BODY_ID` |

> [!TIP]
> The sms.ir sandbox ships a default template (id `123456`, body `کد تایید شما: #CODE#`). Set `SMSIR_OTP_TEMPLATE_ID=123456` and a sandbox key to exercise the OTP flow end-to-end without sending real messages or spending credit.

> [!NOTE]
> For production high-availability, sms.ir recommends whitelisting both of their egress IPs (`185.211.56.44` primary, `78.158.166.99` failover).

## SmsService API

| Method | Purpose |
| ------ | ------- |
| `sendOtp(mobile, code)` | Deliver a one-time code via the active provider |
| `sendText(mobiles, text)` | Free text; **chunked to 100 recipients/call**, one result per chunk |
| `getCredit()` | Remaining account credit |
| `getDeliveryStatus(id)` | Vendor-neutral `{ id, status, delivered }` |

Provider errors surface as `ServiceUnavailableException` (`sms.provider_unavailable`, `sms.rate_limited`) or `BadGatewayException` (`sms.auth_failed`, `sms.send_failed`). The log provider never throws.

## Where it's used

- **Auth phone OTP** — `POST /auth/otp/send-sms` + `/auth/otp/verify-sms` (see [Auth Flow](./auth-flow)).
- **Notifications plugin** — the SMS channel delegates here; a listener sends transactional order SMS on `order.status-changed`; `POST /notifications/sms/bulk` for explicit-list campaigns (`smsBulk` flag). See [Notifications](./plugins/existing-plugins/notifications).
- **Marketing plugin** — `POST /newsletter/sms-broadcast` to subscribers who provided a phone (`smsBroadcast` flag). See [Marketing](./plugins/existing-plugins/marketing).

## Adding another provider

1. Create `src/modules/sms/providers/<name>/<name>.provider.ts` implementing `SmsProvider`.
2. Add the name to `SmsProviderName` in `configuration.ts` and the `SMS_PROVIDER` Joi enum.
3. Register the class and extend the factory branch in `SmsModule.register()`.
4. Add provider env vars + Joi validation.

## Test endpoint

`POST /api/v1/admin/sms/test` sends a real test SMS. Admin-only (`super_admin` / `tenant_admin`). **Every query param is optional** — omitted values fall back to the configured defaults:

| Query param | Default | Notes |
| ----------- | ------- | ----- |
| `provider` | active `SMS_DEFAULT_PROVIDER` | `smsir` / `sabanovin` / `melipayamak` / `log` |
| `line` | provider's configured line | Sender line / gateway (Melipayamak `from`) |
| `apiKey` | provider's configured key | sms.ir & Sabanovin key; ignored for Melipayamak (user/pass) |
| `text` | `Test message from E-Commerce MVP.` | Custom body |
| `phone` | `SMS_TEST_PHONE` | Recipient; `400` if neither query nor env provides one |

```bash
# Defaults only (uses configured provider + key, default text, SMS_TEST_PHONE):
curl -X POST -H 'Authorization: Bearer <admin-jwt>' \
  'http://localhost:3000/api/v1/admin/sms/test?phone=09120000000'

# Try a different provider/key/line/text for one call without changing config:
curl -X POST -H 'Authorization: Bearer <admin-jwt>' \
  'http://localhost:3000/api/v1/admin/sms/test?provider=sabanovin&apiKey=...&line=...&text=hello&phone=09120000000'
```

Overrides apply to that single call only (a one-off provider instance is built via `createSmsProvider`); the app-wide provider is unchanged. The response echoes `{ provider, to, text, result }` — never the API key.

## Sabanovin specifics

Sabanovin is the default provider (`SMS_DEFAULT_PROVIDER=sabanovin`). It has no template — OTPs are sent through the reserved `gateway=otp` with text composed from `SABANOVIN_OTP_TEXT` (`{code}` is substituted). **Every Sabanovin SMS (OTP and free-text) automatically gets the mandatory opt-out keyword appended** — `SABANOVIN_CANCEL_TEXT` (default `لغو11`) — required by Iranian SMS regulations. It's added once, at the end, unless already present. All auth OTP flows (register, login/request-otp, reset-password) go through this provider since they all call `SmsService`.

## Debug logging

Set **`SMS_DEBUG_LOG=true`** to have the active provider log every outgoing SMS (recipient + the exact composed text, including the Sabanovin `لغو11` suffix) to the console — useful for local testing without checking the provider panel. For template-based providers the final text lives on the vendor's side, so the log shows the template/pattern id + code instead (sms.ir `template=… code=…`, Melipayamak `bodyId=… code=…`). Off by default; **keep it off in production** (it would log codes).

## Resilience & troubleshooting

- **A provider failure never crashes the app.** SMS sends are awaited, so a provider rejection becomes a clean `502` (`sms.send_failed` / `sms.auth_failed`) on that request; the rest of the API keeps serving. A process-level safety net in `main.ts` (`unhandledRejection` / `uncaughtException`) logs and keeps the process alive, and production runs with `restart: unless-stopped`.
- **Sabanovin "آدرس IP غیر مجاز" (Unauthorized IP).** Sabanovin only accepts API calls from **whitelisted IPs** — the API key alone isn't enough. Add the calling server's public IP in the Sabanovin panel (web-service / API settings), or disable the IP restriction. Use your machine's current public IP for local dev, and the deployment's outbound IP (e.g. the Liara app's egress IP) in production.
- The selected provider is logged at boot (`Active SMS provider: <name>`); each provider logs the vendor's own failure reason at `warn` (without leaking credentials).

## Per-tenant credentials (future)

Credentials are global today (one provider account per deployment, selected by `SMS_DEFAULT_PROVIDER`). `SmsService` is structured so a per-tenant credential/provider resolver can be layered in without changing call sites — the interface methods stay the same.
