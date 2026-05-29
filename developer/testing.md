# Testing

Jest + ts-jest. Unit tests live alongside the code they cover as `*.spec.ts`. E2E tests live under `test/`.

## Run

```bash
npm test            # unit
npm run test:watch  # watch mode
npm run test:cov    # with coverage thresholds (CI)
npm run test:e2e    # end-to-end
```

## Patterns

The repo uses **plain Jest mocks**, not the NestJS `Test.createTestingModule` builder — services are constructed directly with mocked dependencies. Existing examples:

- `src/modules/orders/orders.service.spec.ts` — service with EventEmitter, mongoose model, pagination.
- `src/plugins/coupons/coupons.service.spec.ts` — service with mongoose model.
- `src/common/feature-flags/feature-flag.service.spec.ts` — service with Redis, TenantsService, ConfigService.
- `src/common/feature-flags/guards/*.spec.ts` — guards with Reflector and a stub service.
- `src/modules/tenants/tenants.service.spec.ts` — service with mongoose model + EventEmitter.

## Mocking Mongoose

```typescript
const wrap = (value: unknown) => ({ exec: () => Promise.resolve(value) });

const model = {
  findOne: jest.fn().mockReturnValue(wrap(someDoc)),
  findOneAndUpdate: jest.fn().mockReturnValue(wrap(updatedDoc)),
  create: jest.fn().mockResolvedValue(newDoc),
};

const service = new MyService(model as never, otherDep);
```

Cast to `never` (or `as unknown as Model<X>`) — Mongoose model types are too rich to mock satisfyingly with TypeScript.

## Mocking guards

```typescript
const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector & {
  getAllAndOverride: jest.Mock;
};
const ctx = {
  switchToHttp: () => ({ getRequest: () => ({ tenantId: 'acme' }) }),
  getHandler: () => ({}),
  getClass: () => ({}),
} as unknown as ExecutionContext;
```

## Coverage thresholds

Per-file thresholds in `jest.config.ts`. Each business-critical service has its own bar (`auth.service`, `products.service`, `cart.service`, `orders.service`, `payments.service`, `coupons.service`, guards). Falling below CI fails.

When adding new services, add a corresponding threshold so it can't silently drift.

## Things to assert

- **Happy path return values** — exact shape, not just type.
- **Exception types** — `await expect(service.foo()).rejects.toBeInstanceOf(BadRequestException)`.
- **Event emissions** — `expect(events.emit).toHaveBeenCalledWith(EVENT_NAME, expect.objectContaining({ ... }))`.
- **Side-effect parameters** — the `$set` / `$addToSet` Mongo update payload.

## What we don't unit-test

- Pure DTOs, schemas, enums, modules (excluded in `collectCoverageFrom`).
- Controllers — they're thin, full e2e tests in `test/` cover the routing.

## When you add a test

If the service didn't have a coverage threshold, add one in `jest.config.ts`. The codebase aims for ≥80% per-file branches on every service.
