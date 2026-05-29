# Plugin Registry

`src/plugins/plugin.registry.ts` is the single source of truth for which plugins exist in the codebase. `src/plugins/plugin-loader.module.ts` decides which of them are loaded in this deployment.

## The registry

```typescript
const PLUGINS: PluginModuleClass[] = [
  CouponsPlugin,
  ReviewsPlugin,
  CompareProductsPlugin,
  WishlistPlugin,
  MarketingPlugin,
  AnalyticsPlugin,
  LoyaltyPointsPlugin,
  NotificationsPlugin,
];

export const PLUGIN_REGISTRY: ReadonlyArray<PluginMetadata> = PLUGINS.map((p) => p.metadata);
export const PLUGIN_MAP: ReadonlyMap<PluginKey, PluginModuleClass> = new Map(
  PLUGINS.map((p) => [p.metadata.key, p] as const),
);
```

Adding a plugin means adding it to the `PLUGINS` array. The map and the metadata array derive from it automatically. The admin endpoint `GET /admin/plugins` reads `PLUGIN_REGISTRY`.

## The loader

```typescript
@Module({})
export class PluginLoaderModule {
  static loadedPluginKeys: ReadonlyArray<PluginKey> = [];

  static forRoot(): DynamicModule {
    const enabled = parseEnabledPlugins(process.env.ENABLED_PLUGINS);
    validatePluginDependencies(enabled);

    const imports: DynamicModule[] = [];
    for (const key of enabled) {
      const cls = PLUGIN_MAP.get(key);
      if (cls) imports.push(cls.register());
    }
    PluginLoaderModule.loadedPluginKeys = enabled;
    return { module: PluginLoaderModule, imports, exports: imports };
  }
}
```

Three concerns:

1. **Parse** `ENABLED_PLUGINS` — throws on an unknown key.
2. **Validate dependencies** — throws when a loaded plugin's `dependsOn` is missing.
3. **Register** — calls `<Plugin>.register()` and imports the result into the `AppModule`.

After boot, `PluginLoaderModule.loadedPluginKeys` is read by the admin endpoint to set `loadedInThisDeployment` on each plugin in the registry.

## The plugin contract

```typescript
// src/plugins/plugin.interface.ts
export interface PluginMetadata {
  key: PluginKey;
  name: string;
  description: string;
  version: string;
  dependsOn?: PluginKey[];
  defaultFlags: Record<string, boolean>;
}

export interface PluginModuleClass {
  readonly metadata: PluginMetadata;
  register(): DynamicModule;
}
```

The `PluginKey` type is the union from `src/common/plugins/plugin-keys.ts`. TypeScript prevents you from registering metadata with a typo'd key.

## Dependency graph

Today the only `dependsOn` edge is:

```
loyaltyPoints  →  reviews
```

`LoyaltyPointsPlugin` listens to `review.approved` and would emit awards even if `reviews` was off. Declaring the dependency means the loader **refuses to boot** if you enable `loyaltyPoints` without `reviews`.

Add new edges in your plugin's metadata. The loader handles the rest.

## Admin endpoint

`GET /api/v1/admin/plugins` is the read-only registry view exposed to operators:

```json
[
  {
    "key": "loyaltyPoints",
    "name": "Loyalty Points",
    "description": "Earn-and-burn loyalty points awarded on purchase and reviews.",
    "version": "1.0.0",
    "dependsOn": ["reviews"],
    "defaultFlags": { "pointsOnPurchase": true, "pointsOnReview": false, "pointsRedemption": true },
    "loadedInThisDeployment": true
  }
]
```
