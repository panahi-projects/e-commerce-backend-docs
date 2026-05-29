# Feature Flags API

The runtime layer. `FeatureFlagService` is global (provided by `FeatureFlagsModule` with `@Global()`) so you can inject it anywhere.

## Public API

```typescript
class FeatureFlagService {
  isPluginEnabled(tenantId: string, pluginKey: string): Promise<boolean>;
  isFlagEnabled(tenantId: string, pluginKey: string, flagKey: string): Promise<boolean>;
  getPluginFlags(tenantId: string, pluginKey: string): Promise<Record<string, boolean>>;
  invalidateCache(tenantId: string): Promise<void>;
}
```

## When to call it directly

Most of the time you don't — the `@RequiresPlugin` and `@FeatureFlag` decorators + `APP_GUARD` cover route-level enforcement.

Call it directly when:

1. **Event handlers** — events fire async, outside the request lifecycle, so guards don't run. Check the flag manually before doing work.
2. **Runtime type-dispatched gating** — example: the `coupons` plugin's `/validate` endpoint checks `percentageCoupons` or `fixedCoupons` based on the type of coupon returned. The decorator can't know the type ahead of time, so the controller does the check after the lookup.

## Caching contract

| Operation                     | Behaviour                                                                   |
| ----------------------------- | --------------------------------------------------------------------------- |
| First call for a tenant       | Mongo read via `TenantsService.getEffectiveConfig`, then Redis `SET EX 300` |
| Subsequent calls within TTL   | Redis `GET`, parsed JSON                                                    |
| Tenant mutation               | `TenantsService` emits `tenant.config.changed` → cache key `DEL`            |
| Redis `GET` fails             | Logged at warn, falls back to Mongo                                         |
| Redis `SET` fails             | Logged at warn, request still succeeds (uncached)                           |
| Unknown tenant (Mongo throws) | Returns an inactive config; every check fails closed                        |
| Tenant `isActive: false`      | Every check returns `false`                                                 |

TTL is `FEATURE_FLAGS_CACHE_TTL_SECONDS` (default `300`). Setting it to `0` disables write-back caching entirely (every request hits Mongo).

## The decorators

```typescript
// metadata only, no @UseGuards inside (would overwrite guard stacks)
export const RequiresPlugin = (key: string) => SetMetadata(REQUIRES_PLUGIN_METADATA, key);

export const FeatureFlag = (pluginKey: string, flagKey: string) =>
  SetMetadata(FEATURE_FLAG_METADATA, { pluginKey, flagKey });
```

The guards (`RequiresPluginGuard`, `FeatureFlagGuard`) are registered as `APP_GUARD` providers in `FeatureFlagsModule`. They check metadata first and short-circuit to `true` when nothing is set.

## Resolving tenantId

The guards read `request[TENANT_REQUEST_KEY]` set by `TenantMiddleware`. The middleware tries:

1. Subdomain (e.g. `acme.example.com` → `acme`)
2. `X-Tenant-ID` header
3. JWT `tenantId` claim (decoded without signature verification — just for routing)
4. Fallback `default`

If you call `FeatureFlagService` directly, pass the tenantId yourself (`@TenantId() tenantId: string` decorator).

## Example — runtime check in a service

```typescript
@OnEvent('order.completed')
async handleOrderCompleted(event: OrderCompletedEvent) {
  const ok = await this.featureFlags.isFlagEnabled(
    event.tenantId,
    'loyaltyPoints',
    'pointsOnPurchase',
  );
  if (!ok) return;
  await this.award(event.userId, event.total);
}
```

## Example — runtime check in a controller

```typescript
@Post('validate')
async validate(@Body() dto: ValidateCouponDto, @TenantId() tenantId: string) {
  const result = await this.coupons.validate(dto);
  const flagKey = FLAG_FOR_TYPE[result.type]; // percentageCoupons / fixedCoupons / freeShippingCoupons
  const allowed = await this.featureFlags.isFlagEnabled(tenantId, 'coupons', flagKey);
  if (!allowed) throw new ForbiddenException(/* … */);
  return result;
}
```
