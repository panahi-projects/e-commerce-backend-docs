# SMS

Generic SMS provider abstraction with an [sms.ir](https://sms.ir) implementation. Like payments, the rest of the app depends only on an interface — swapping providers is config-only.

## The interface

```typescript
// src/modules/sms/sms-provider.interface.ts
export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SmsProvider {
  readonly name: string;
  sendVerify(mobile: string, templateId: string, parameters: SmsTemplateParameter[]): Promise<SmsVerifyResult>;
  sendText(mobiles: string[], text: string): Promise<SmsTextResult>;
  getCredit(): Promise<number>;
  getDeliveryStatus(messageId: number): Promise<SmsDeliveryStatus>;
}
```

`SmsService` injects the active provider via `@Inject(SMS_PROVIDER)`. `SmsModule.register()` (global, wired in `AppModule`) chooses the concrete provider at boot from config.

## Providers

| Provider | Class | When |
| -------- | ----- | ---- |
| `smsir`  | `SmsIrProvider` (`providers/sms-ir/`) | When `SMSIR_API_KEY` is set, or `SMS_PROVIDER=smsir` |
| `log`    | `LogSmsProvider` (`providers/log/`)   | Default fallback — logs instead of sending, so the app boots without credentials |

The sms.ir provider calls `https://api.sms.ir/v1` with native `fetch` (no extra HTTP dependency), sets the `X-API-KEY` header, and unwraps the `{ status, message, data }` envelope (`status === 1` = success). The API key is never written to logs.

## Configuration

| Env | Default | Notes |
| --- | ------- | ----- |
| `SMS_PROVIDER` | auto | `smsir` or `log` |
| `SMSIR_BASE_URL` | `https://api.sms.ir/v1` | |
| `SMSIR_API_KEY` | _empty_ | panel → Developer. Use a **Sandbox** key in dev |
| `SMSIR_LINE_NUMBER` | _empty_ | service line for `sendText` (`/send/bulk`) |
| `SMSIR_OTP_TEMPLATE_ID` | _empty_ | verify template id. Sandbox default `123456` |
| `SMSIR_OTP_PARAMETER_NAME` | `CODE` | placeholder name in the verify template |
| `SMSIR_SANDBOX` | `false` | no real send, no credit consumed |
| `SMSIR_TIMEOUT_MS` | `10000` | per-request timeout (AbortController) |

> [!TIP]
> The sms.ir sandbox ships a default template (id `123456`, body `کد تایید شما: #CODE#`). Set `SMSIR_OTP_TEMPLATE_ID=123456` and a sandbox key to exercise the OTP flow end-to-end without sending real messages or spending credit.

> [!NOTE]
> For production high-availability, sms.ir recommends whitelisting both of their egress IPs (`185.211.56.44` primary, `78.158.166.99` failover).

## SmsService API

| Method | sms.ir endpoint | Purpose |
| ------ | --------------- | ------- |
| `sendOtp(mobile, code)` | `POST /send/verify` | Templated OTP using `SMSIR_OTP_TEMPLATE_ID` |
| `sendText(mobiles, text)` | `POST /send/bulk` | Free text; **chunked to 100 recipients/call**, one result per chunk |
| `getCredit()` | `GET /credit` | Remaining account credit |
| `getDeliveryStatus(messageId)` | `GET /send/{id}` | Delivery state |

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

## Per-tenant credentials (future)

Credentials are global today (one sms.ir account per deployment). `SmsService` is structured so a per-tenant credential resolver can be layered in without changing call sites — the interface methods stay the same.
