# My Profile

How to view and edit your account, addresses, and saved details.

## View profile

```bash
curl http://localhost:3000/api/v1/profile -H 'Authorization: Bearer <access-token>'
```

Returns your name, email, role, email-verification status, and saved addresses.

## Update profile

```bash
curl -X PATCH http://localhost:3000/api/v1/profile \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "firstName": "Jane" }'
```

All fields are **optional** — send only the ones you want to change (e.g. just `firstName`).

If your account registered with a **phone number**, that phone can't be changed here (it's your login identity) — attempting to change it returns `400`. Email likewise cannot be changed via this endpoint.

## Addresses

A profile can carry many shipping addresses. One can be marked as default.

```bash
# List
curl http://localhost:3000/api/v1/profile/addresses -H 'Authorization: Bearer <access-token>'

# Add
curl -X POST http://localhost:3000/api/v1/profile/addresses \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{
    "label": "Home",
    "fullName": "Jane Doe",
    "phone": "+1-555-0100",
    "line1": "42 Maple St",
    "city": "Austin",
    "state": "TX",
    "postalCode": "73301",
    "country": "US",
    "isDefault": true
  }'

# Update
curl -X PATCH http://localhost:3000/api/v1/profile/addresses/<addressId> \
  -H 'Authorization: Bearer <access-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "phone": "+1-555-0199" }'

# Delete
curl -X DELETE http://localhost:3000/api/v1/profile/addresses/<addressId> \
  -H 'Authorization: Bearer <access-token>'
```

Setting `isDefault: true` unsets it on any previously default address.

## Wishlist

Wishlist endpoints have moved out of profile and live under `/wishlist` when the `wishlist` plugin is enabled for your tenant — see the [Wishlist guide](./plugins/wishlist).

## FAQ

**How do I delete my account?**
Account deletion is an admin operation today (soft-delete via `DELETE /admin/users/:id`). Contact support.

**Why can't I see my orders here?**
Order history lives under `/orders/my`, not `/profile`. See the [Orders guide](./orders).
