# Marketing (Developer)

| Field         | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Plugin key    | `marketing`                                                              |
| Module class  | `MarketingPlugin` in `src/plugins/marketing/marketing.plugin.ts`         |
| Controllers   | `BannersController` (`/banners`), `NewsletterController` (`/newsletter`) |
| Mongo schemas | `banners`, `newsletter_subscribers` (`src/plugins/marketing/schemas/`)   |
| Depends on    | (none)                                                                   |

## Flags

| Flag             | Default | What it does                               |
| ---------------- | ------- | ------------------------------------------ |
| `banners`        | `true`  | Class-level gate on `BannersController`    |
| `newsletter`     | `true`  | Class-level gate on `NewsletterController` |
| `popups`         | `false` | Reserved (no controller today)             |
| `referralSystem` | `false` | Reserved (no controller today)             |
| `smsBroadcast`   | `false` | Enables `POST /newsletter/sms-broadcast`   |

## Endpoints

| Method   | Path                      | Auth        | Gating                                    |
| -------- | ------------------------- | ----------- | ----------------------------------------- |
| `GET`    | `/banners`                | Public      | `@FeatureFlag('marketing', 'banners')`    |
| `POST`   | `/banners`                | ADMIN/STAFF | `@FeatureFlag('marketing', 'banners')`    |
| `PATCH`  | `/banners/:id`            | ADMIN/STAFF | `@FeatureFlag('marketing', 'banners')`    |
| `DELETE` | `/banners/:id`            | ADMIN       | `@FeatureFlag('marketing', 'banners')`    |
| `POST`   | `/newsletter/subscribe`   | Public      | `@FeatureFlag('marketing', 'newsletter')` |
| `POST`   | `/newsletter/unsubscribe` | Public      | `@FeatureFlag('marketing', 'newsletter')` |
| `GET`    | `/newsletter/subscribers` | ADMIN/STAFF | `@FeatureFlag('marketing', 'newsletter')`    |
| `POST`   | `/newsletter/sms-broadcast`| ADMIN      | `@FeatureFlag('marketing', 'smsBroadcast')`  |

The `newsletter` flag is applied at the class level so every newsletter endpoint inherits it. The `sms-broadcast` route declares its own `smsBroadcast` flag at the method level (method metadata wins over the class flag).

## SMS broadcast

`POST /newsletter/sms-broadcast` (body `{ text }`) sends to every `subscribed` member who provided a `phone`. Subscribers opt in via `POST /newsletter/subscribe` with an optional `phone` field (Iranian mobile format). The broadcast is self-contained to the marketing plugin's own data — it does **not** import the notifications plugin (zero plugin-to-plugin coupling); it calls the core `SmsService` directly. Returns `{ recipients }`.

## Banner schema essentials

```typescript
{
  title: { en, fa },
  image: string,
  link: string,
  position: 'homepage_top' | 'homepage_bottom' | 'category' | ...,
  startsAt?: Date,
  expiresAt?: Date,
  isActive: boolean,
}
```

`GET /banners` returns banners where `isActive: true` and `startsAt <= now <= expiresAt` (open-ended bounds allowed).

## Newsletter status

`pending | confirmed | unsubscribed`. Subscription generates a confirmation token (random bytes) emailed to the address; `POST /newsletter/unsubscribe` accepts the same token shape.

## Future referral system

The `referralSystem` flag is declared but no controller exists. The intent is `/referral/code`, `/referral/redeem`, and event emission on first qualifying order for the referrer. Add it as a new controller alongside the existing two — same plugin, no migration needed.
