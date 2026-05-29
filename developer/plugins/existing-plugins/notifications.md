# Notifications (Developer)

| Field           | Value                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| Plugin key      | `notifications`                                                              |
| Module class    | `NotificationsPlugin` in `src/plugins/notifications/notifications.plugin.ts` |
| Controller path | `/api/v1/notifications`                                                      |
| Storage         | None of its own. Email path can integrate with the core `MailService`.       |
| Depends on      | (none)                                                                       |

## Flags

| Flag                 | Default | What it does                        |
| -------------------- | ------- | ----------------------------------- |
| `emailNotifications` | `true`  | Enables `POST /notifications/email` |
| `smsNotifications`   | `false` | Enables `POST /notifications/sms`   |
| `pushNotifications`  | `false` | Enables `POST /notifications/push`  |

## Endpoints

| Method | Path                   | Auth        | Gating                                                |
| ------ | ---------------------- | ----------- | ----------------------------------------------------- |
| `POST` | `/notifications/email` | ADMIN/STAFF | `@FeatureFlag('notifications', 'emailNotifications')` |
| `POST` | `/notifications/sms`   | ADMIN/STAFF | `@FeatureFlag('notifications', 'smsNotifications')`   |
| `POST` | `/notifications/push`  | ADMIN/STAFF | `@FeatureFlag('notifications', 'pushNotifications')`  |

All three accept `{ recipient, subject, body }` and return `202 Accepted` with `{ queued: true }`.

## Channels

Three channel classes implementing a shared `NotificationChannel` interface:

```typescript
interface NotificationChannel {
  readonly name: 'email' | 'sms' | 'push';
  send(recipient: string, subject: string, body: string): Promise<void>;
}
```

The current implementations log the request and return `Promise.resolve()`. They're stubs — wire them to the real providers (SES, Twilio, FCM) here.

## Why a plugin instead of using MailService directly

The core `MailService` is for **transactional** email (password reset, OTP, order confirmations). It is always loaded.

`NotificationsPlugin` is a **multi-channel** dispatcher with per-tenant gating — useful for marketing-style messages where the tenant decides which channels are available. The two coexist.

## How to wire a real provider

1. Replace the body of `EmailNotificationChannel.send` with a call to your provider's SDK (or hand off to `MailService.sendQueued(...)`).
2. Add provider credentials to `src/config/configuration.schema.ts`.
3. Inject the new config in `NotificationsPlugin.register()` if needed.
4. Update the channel's unit tests under `src/plugins/notifications/channels/*.spec.ts`.
