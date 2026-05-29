# Plugin System Overview

A plugin is a self-contained NestJS `DynamicModule` registered conditionally at boot based on the `ENABLED_PLUGINS` env var. Each plugin exposes per-tenant **feature flags** that gate sub-features at runtime.

## Two layers

```
┌────────────────────────────────────────────────────────────────────┐
│  Layer 1 — Plugin loader (boot-time)                               │
│  src/plugins/plugin-loader.module.ts                               │
│                                                                    │
│  ENABLED_PLUGINS=coupons,reviews,compareProducts,…                 │
│       │                                                            │
│       ▼  parse → validate dependsOn → throw if missing dep         │
│  PluginLoaderModule.forRoot()                                      │
│       │                                                            │
│       ▼  call <Plugin>.register() for each enabled key             │
│  Imports DynamicModules into AppModule                             │
│                                                                    │
│  Result: disabled plugins are not loaded at all — their providers, │
│          controllers, and routes do not exist in DI.               │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  Layer 2 — Feature flags (runtime, per-tenant)                     │
│  src/common/feature-flags/                                         │
│                                                                    │
│  Tenant doc: { enabledPlugins: ['coupons'],                        │
│                featureFlags: { coupons: { percentageCoupons: true, │
│                                           fixedCoupons: false } } }│
│                                                                    │
│  FeatureFlagService.isFlagEnabled(tenantId, plugin, flag)          │
│    → Redis cache (5 min TTL) → Mongo on miss                       │
│    → returns false on plugin disabled / Redis down / unknown tenant│
│                                                                    │
│  Enforced by APP_GUARD via @RequiresPlugin / @FeatureFlag metadata │
└────────────────────────────────────────────────────────────────────┘
```

## What's a plugin

| Property                                                       | Implication                                |
| -------------------------------------------------------------- | ------------------------------------------ |
| Lives under `src/plugins/<plugin-folder>/`                     | Path alias `@plugins/<plugin-folder>/…`    |
| Exports a class with `static metadata` and `static register()` | The `PluginModuleClass` contract           |
| Listed in `src/plugins/plugin.registry.ts`                     | Discovered by loader + admin endpoints     |
| Mentioned in `src/common/plugins/plugin-keys.ts`               | Type-safe key list                         |
| Optional `dependsOn: PluginKey[]`                              | Validated at boot AND at admin enable time |
| Provides `defaultFlags: Record<string, boolean>`               | Seeded on first enable per tenant          |

## Coupling rules

- Plugins **may** import from core modules (`@modules/...`).
- Plugins **may NOT** import from other plugins. Use events.
- Core modules **may NOT** import from plugins. When a core module needs a plugin service (e.g. `CartService` wants `CouponsService` for `applyCoupon`), it uses `@Optional()` injection and degrades gracefully when the plugin isn't loaded.

## Boot-time validation

`PluginLoaderModule.forRoot()` throws on:

- Unknown plugin key in `ENABLED_PLUGINS`.
- A loaded plugin whose `dependsOn` is not in the enabled set.

The app refuses to start with a clear error message — no silent fallbacks.

## Admin-time validation

`TenantsService` adds two more gates:

- `enablePlugin` returns `400` if a dependency is missing in the tenant's `enabledPlugins`.
- `disablePlugin` returns `409` if another currently enabled plugin depends on this one.

## Decorators

| Decorator                 | Where to apply   | What it does                                        |
| ------------------------- | ---------------- | --------------------------------------------------- |
| `@RequiresPlugin(key)`    | Controller class | 403 unless the tenant has `key` in `enabledPlugins` |
| `@FeatureFlag(key, flag)` | Route handler    | 403 unless `featureFlags[key][flag]` is `true`      |

Both are metadata-only. The actual guard is global (`APP_GUARD`) via `FeatureFlagsModule`, so stacking with `@UseGuards(RolesGuard)` works.

## Where to go next

- [Creating a Plugin](./creating-a-plugin) — copy-paste step-by-step.
- [Feature Flags API](./feature-flags) — the service surface for runtime checks.
- [Plugin Registry](./plugin-registry) — how the loader resolves and validates.
- Per-plugin developer references under "Existing Plugins" in the sidebar.
