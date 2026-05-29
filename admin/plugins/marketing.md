# Marketing (Admin)

The `marketing` plugin ships two controllers — banners and newsletter — each gated by its own flag (`banners`, `newsletter`). A third flag `referralSystem` is declared on the plugin but the referral controller is not yet implemented in this MVP.

## Banners

| Method   | Path                  | Role        | Purpose                        |
| -------- | --------------------- | ----------- | ------------------------------ |
| `GET`    | `/api/v1/banners`     | Public      | Active banners (within window) |
| `POST`   | `/api/v1/banners`     | ADMIN/STAFF | Create                         |
| `PATCH`  | `/api/v1/banners/:id` | ADMIN/STAFF | Update                         |
| `DELETE` | `/api/v1/banners/:id` | ADMIN       | Delete                         |

```bash
curl -X POST http://localhost:3000/api/v1/banners \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "title": { "en": "Summer Sale", "fa": "فروش تابستانه" },
    "image": "/uploads/summer.jpg",
    "link": "/categories/sale",
    "position": "homepage_top",
    "startsAt": "2026-06-01T00:00:00Z",
    "expiresAt": "2026-06-30T23:59:59Z"
  }'
```

## Newsletter

| Method | Path                             | Role        | Purpose                         |
| ------ | -------------------------------- | ----------- | ------------------------------- |
| `POST` | `/api/v1/newsletter/subscribe`   | Public      | Subscribe by email              |
| `POST` | `/api/v1/newsletter/unsubscribe` | Public      | Unsubscribe by token from email |
| `GET`  | `/api/v1/newsletter/subscribers` | ADMIN/STAFF | Audit list                      |

A subscription has `status`: `pending | confirmed | unsubscribed`. The platform sends a confirmation email by default — only `confirmed` subscribers are valid recipients.

## Common workflow — campaign launch

1. Create the banner (`POST /banners`) with a tight `startsAt`/`expiresAt` window.
2. Optionally adjust `marketing.banners` flag if you want this tenant to be the only one running the campaign.
3. Mail the campaign through your provider, using `GET /newsletter/subscribers` as the recipient source.
