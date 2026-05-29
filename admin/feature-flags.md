# Feature Flags (Admin)

Feature flags are per-plugin boolean toggles stored on the tenant document. They control which sub-features of an already-enabled plugin a tenant gets — without redeployment.

## Read the current flag map

```bash
curl http://localhost:3000/api/v1/admin/tenants/acme-corp/plugins \
  -H 'Authorization: Bearer <admin-token>'
```

The `flags` field on each plugin in the response is the merged view: the plugin's `defaultFlags` overlaid with whatever the tenant has explicitly set.

## Patch flags for one plugin

```bash
curl -X PATCH \
  -H 'Authorization: Bearer <admin-token>' \
  -H 'Content-Type: application/json' \
  -d '{ "flags": { "freeShippingCoupons": true, "perUserLimit": false } }' \
  http://localhost:3000/api/v1/admin/tenants/acme-corp/flags/coupons
```

Flags are **shallow-merged** into the existing per-plugin map. Setting one flag doesn't reset the others.

### Validation

| Error                                      | When                                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| `400 tenants.plugin_not_enabled:<k>`       | The plugin isn't in the tenant's `enabledPlugins`     |
| `400 tenants.unknown_flag:<plugin>.<flag>` | The flag isn't in the plugin's `defaultFlags` catalog |
| `400 tenants.flag_must_be_boolean`         | A value is not a literal `true`/`false`               |

## Propagation latency

- The `TenantsService` emits `tenant.config.changed` after every mutation.
- The `FeatureFlagService` listens and deletes the tenant's Redis cache key.
- Subsequent requests refetch from MongoDB.
- Default TTL is `FEATURE_FLAGS_CACHE_TTL_SECONDS=300` — that is the upper bound if invalidation drops.

## Common workflow — flash sale

1. `PATCH /admin/tenants/<id>/flags/coupons` — turn `freeShippingCoupons: true`.
2. Run the sale.
3. `PATCH /admin/tenants/<id>/flags/coupons` — set it back to `false`.

No deploy in either direction.

## Common workflow — A/B test rollout

Per-flag toggles let you stage a feature for select tenants. Enable for one tenant, observe metrics, then roll out to others. Disabling does not destroy any data — only blocks access.
