# Creating a New Plugin

This is the canonical guide for adding a new plugin. Copy-paste, fill in the blanks, ship.

## Prerequisites

Read [Plugin System Overview](./overview) and [Feature Flags API](./feature-flags) first.

## Step 1 — Decide the plugin key

A plugin key is a camelCase identifier used in `ENABLED_PLUGINS`, `tenant.enabledPlugins`, `@RequiresPlugin`, `@FeatureFlag`, and the registry. Make it short and stable.

Add it to the canonical list:

```typescript
// src/common/plugins/plugin-keys.ts
export const PLUGIN_KEYS = [
  'coupons',
  'reviews',
  'compareProducts',
  // ... existing keys
  'yourPlugin', // ← add yours
] as const;
```

## Step 2 — Create the folder

```
src/plugins/your-plugin/
├── your-plugin.plugin.ts        # DynamicModule + metadata
├── your-plugin.controller.ts    # routes + guard decorators
├── your-plugin.service.ts       # business logic
├── your-plugin.service.spec.ts  # unit tests
├── dto/
│   └── <your>.dto.ts            # class-validator DTOs
└── schemas/
    └── <your>.schema.ts         # Mongoose schemas if needed
```

> [!TIP]
> The folder name can be kebab-case (`compare-products/`, `loyalty-points/`) — the plugin **key** stays camelCase.

## Step 3 — Define the plugin module

```typescript
// src/plugins/your-plugin/your-plugin.plugin.ts
import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PluginMetadata } from '../plugin.interface';
import { YourSchema, YourSchemaFactory } from './schemas/your.schema';
import { YourService } from './your-plugin.service';
import { YourController } from './your-plugin.controller';

@Module({})
export class YourPlugin {
  static readonly metadata: PluginMetadata = {
    key: 'yourPlugin',
    name: 'Your Plugin',
    description: 'One sentence about what it does.',
    version: '1.0.0',
    dependsOn: [], // e.g. ['reviews'] if you listen to review.approved
    defaultFlags: {
      someFlag: true,
      anotherFlag: false,
    },
  };

  static register(): DynamicModule {
    return {
      module: YourPlugin,
      global: true, // recommended — lets core modules optionally inject your service
      imports: [
        MongooseModule.forFeature([{ name: YourSchema.name, schema: YourSchemaFactory }]),
        // any core modules you depend on, e.g. ProductsModule
      ],
      controllers: [YourController],
      providers: [YourService],
      exports: [YourService],
    };
  }
}
```

## Step 4 — Register in the plugin registry

```typescript
// src/plugins/plugin.registry.ts
import { YourPlugin } from './your-plugin/your-plugin.plugin';

const PLUGINS: PluginModuleClass[] = [
  // ... existing plugins
  YourPlugin,
];
```

The loader and admin endpoints discover everything from this array.

## Step 5 — Decorate the controller

```typescript
// src/plugins/your-plugin/your-plugin.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { Role } from '@common/enums/role.enum';
import { RolesGuard } from '@common/guards/roles.guard';
import { FeatureFlag, RequiresPlugin } from '@common/feature-flags';
import { YourService } from './your-plugin.service';

@ApiTags('[Plugin] Your Plugin')
@ApiBearerAuth('bearer')
@ApiForbiddenResponse({
  description: 'Plugin not enabled for this tenant or feature flag is disabled',
})
@RequiresPlugin('yourPlugin')
@UseGuards(RolesGuard)
@Controller({ path: 'your-plugin', version: '1' })
export class YourController {
  constructor(private readonly service: YourService) {}

  @ApiOperation({ summary: 'Do the thing' })
  @FeatureFlag('yourPlugin', 'someFlag')
  @Roles(Role.TENANT_ADMIN)
  @Get('thing')
  thing() {
    return this.service.doTheThing();
  }
}
```

## Step 6 — Add i18n keys

```
src/i18n/en/your-plugin.json
src/i18n/fa/your-plugin.json
```

Both files. Missing translations silently fall back to the key.

## Step 7 — Add to ENABLED_PLUGINS

```env
# .env  AND  .env.example
ENABLED_PLUGINS=coupons,reviews,…,yourPlugin
```

## Step 8 — Seed for testing

```typescript
// src/database/seeders/seed.ts → SEED_TENANTS
{
  tenantId: 'default',
  enabledPlugins: [..., 'yourPlugin'],
  featureFlags: {
    ...,
    yourPlugin: { someFlag: true, anotherFlag: false },
  },
}
```

## Step 9 — Listen to events (when needed)

If your plugin reacts to something happening elsewhere (e.g. `order.completed`), inject `EventEmitter2` and decorate the handler:

```typescript
@OnEvent('order.completed')
async handleOrderCompleted(event: OrderCompletedEvent) {
  const allowed = await this.featureFlags.isFlagEnabled(
    event.tenantId,
    'yourPlugin',
    'someFlag',
  );
  if (!allowed) return;
  // ... do work
}
```

`import type` the event payload to satisfy `isolatedModules` + `emitDecoratorMetadata`.

## Step 10 — Write tests

Mirror `src/plugins/coupons/coupons.service.spec.ts` for service tests. Mirror `src/common/feature-flags/guards/*.spec.ts` if you add custom guards.

Add a per-file coverage threshold for your service in `jest.config.ts` so it can't silently drift.

## Step 11 — Commit

```bash
git commit -m "feat(plugins): add your-plugin plugin"
```

## Checklist

- [ ] Folder created under `src/plugins/`.
- [ ] Plugin key added to `src/common/plugins/plugin-keys.ts`.
- [ ] `PluginMetadata` defined with key, name, description, version, `defaultFlags`, optional `dependsOn`.
- [ ] `YourPlugin.register()` returns a valid `DynamicModule` with `global: true` if any core module should be able to optionally inject the service.
- [ ] Registered in `PLUGIN_REGISTRY` in `plugin.registry.ts`.
- [ ] `@RequiresPlugin('yourPlugin')` on every controller class.
- [ ] `@FeatureFlag('yourPlugin', '<flag>')` on every flag-gated route handler.
- [ ] `@ApiTags('[Plugin] …')` + `@ApiForbiddenResponse(...)` at class level.
- [ ] i18n keys in `en/` and `fa/`.
- [ ] Plugin key added to `ENABLED_PLUGINS` in `.env` and `.env.example`.
- [ ] Seeded into the `default` tenant in `src/database/seeders/seed.ts`.
- [ ] Unit tests written and passing.
- [ ] Coverage threshold for the new service added in `jest.config.ts`.
- [ ] Developer doc under `docs/developer/plugins/existing-plugins/your-plugin.md`.
- [ ] Admin doc under `docs/admin/plugins/your-plugin.md`.
- [ ] User doc under `docs/guide/plugins/your-plugin.md` (when user-facing).
- [ ] `docs/ai/codebase-map.md` updated.
- [ ] Commit: `feat(plugins): add your-plugin plugin`.
