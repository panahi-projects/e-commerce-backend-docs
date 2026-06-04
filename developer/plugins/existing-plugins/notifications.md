# Notifications (Developer)

| Field           | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Plugin key      | `notifications`                                                              |
| Module class    | `NotificationsPlugin` in `src/plugins/notifications/notifications.plugin.ts` |
| Controller path | `/api/v1/notifications`                                                      |
| Storage         | None of its own. SMS path delegates to the core `SmsService`.                |
| Depends on      | Imports core `UsersModule` (phone lookup for transactional SMS)              |

## Flags

| Flag                 | Default | What it does                              |
| -------------------- | ------- | ----------------------------------------- |
| `emailNotifications` | `true`  | Enables `POST /notifications/email`       |
| `smsNotifications`   | `false` | Enables `POST /notifications/sms` **and** transactional order SMS |
| `pushNotifications`  | `false` | Enables `POST /notifications/push`        |
| `smsBulk`            | `false` | Enables `POST /notifications/sms/bulk`    |

## Endpoints

| Method | Path                     | Auth        | Gating                                                |
| ------ | ------------------------ | ----------- | ----------------------------------------------------- |
| `POST` | `/notifications/email`   | ADMIN/STAFF | `@FeatureFlag('notifications', 'emailNotifications')` |
| `POST` | `/notifications/sms`     | ADMIN/STAFF | `@FeatureFlag('notifications', 'smsNotifications')`   |
| `POST` | `/notifications/push`    | ADMIN/STAFF | `@FeatureFlag('notifications', 'pushNotifications')`  |
| `POST` | `/notifications/sms/bulk`| ADMIN       | `@FeatureFlag('notifications', 'smsBulk')`            |

`email` / `sms` / `push` accept `{ recipient, subject, body }` and return `202 Accepted`. `sms/bulk` accepts `{ mobiles: string[], text }` and returns `{ recipients }` — `SmsService` chunks the list to 100 numbers per provider call.

## Transactional order SMS

`notifications.listener.ts` listens to `order.status-changed`. Because event handlers run outside the request pipeline, it resolves the tenant from the event payload and checks the `smsNotifications` flag itself (guards don't apply to events). When the order belongs to a user with a phone and the flag is on, it sends a status SMS via `SmsService`. Guest orders (no `userId`) are skipped.

## Channels

Three channel classes implementing a shared `NotificationChannel` interface:

```typescript
interface NotificationChannel {
  readonly name: 'email' | 'sms' | 'push';
  send(recipient: string, subject: string, body: string): Promise<void>;
}
```

The **SMS channel is wired** to the core `SmsService` (sms.ir behind the provider abstraction — see [SMS](../../sms)). The email and push channels still log and return `Promise.resolve()` — wire them to real providers (SES, FCM) here.

## Why a plugin instead of using MailService directly

The core `MailService` is for **transactional** email (password reset, OTP, order confirmations). It is always loaded.

`NotificationsPlugin` is a **multi-channel** dispatcher with per-tenant gating — useful for marketing-style messages where the tenant decides which channels are available. The two coexist.

## How to wire a real provider

The SMS channel is already wired to `SmsService` (see [SMS](../../sms) for swapping the SMS provider). For the remaining channels:

1. Replace the body of `EmailNotificationChannel.send` with a call to your provider's SDK (or hand off to `MailService`).
2. Add provider credentials to `src/config/configuration.schema.ts`.
3. Inject the new config in `NotificationsPlugin.register()` if needed.
4. Update the channel's unit tests under `src/plugins/notifications/`.
