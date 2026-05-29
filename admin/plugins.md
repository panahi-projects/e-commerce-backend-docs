# Plugins (Admin)

Two endpoints give you full visibility and control over which plugins are available and who has them.

## Inspect the deployment registry

```bash
curl http://localhost:3000/api/v1/admin/plugins \
  -H 'Authorization: Bearer <admin-token>'
```

Returns every plugin in the registry annotated with `loadedInThisDeployment`. A plugin with `loadedInThisDeployment: false` is in the codebase but was not in `ENABLED_PLUGINS` at boot — you cannot enable it for any tenant until that env var is updated and the app restarted.

Example item:

```json
{
  "key": "loyaltyPoints",
  "name": "Loyalty Points",
  "description": "Earn-and-burn loyalty points awarded on purchase and reviews.",
  "version": "1.0.0",
  "dependsOn": ["reviews"],
  "defaultFlags": { "pointsOnPurchase": true, "pointsOnReview": false, "pointsRedemption": true },
  "loadedInThisDeployment": true
}
```

## Per-tenant plugin status

```bash
curl http://localhost:3000/api/v1/admin/tenants/acme-corp/plugins \
  -H 'Authorization: Bearer <admin-token>'
```

Returns each plugin's:

- `enabled` — is it in the tenant's `enabledPlugins`?
- `loadedInDeployment` — is it loaded in this deployment?
- `flags` — defaults merged with the tenant's overrides.

## Enable / disable a plugin for a tenant

```bash
# Enable
curl -X PATCH \
  -H 'Authorization: Bearer <admin-token>' \
  http://localhost:3000/api/v1/admin/tenants/acme-corp/plugins/coupons/enable

# Disable
curl -X PATCH \
  -H 'Authorization: Bearer <admin-token>' \
  http://localhost:3000/api/v1/admin/tenants/acme-corp/plugins/coupons/disable
```

- Enabling seeds the plugin's `defaultFlags` for this tenant **without overwriting existing overrides**.
- Enabling fails with `400` if the plugin declares `dependsOn` and the dependency is not already on for the tenant. Example: `loyaltyPoints` requires `reviews`.
- Disabling fails with `409` if another enabled plugin depends on this one.
- Both calls invalidate the tenant's feature-flag cache.

## Why a plugin appears not loaded

- The plugin key is missing from `ENABLED_PLUGINS` in `.env`.
- The dependency chain failed at boot (the loader throws on unmet `dependsOn`).
- The plugin module was not registered correctly in `src/plugins/plugin.registry.ts`.

Check the application's startup logs — the `PluginLoaderModule` logs each `Loaded plugin: <key>` line.
