# Database

MongoDB via `@nestjs/mongoose@^11`. Connection lives in `src/database/database.module.ts`. Schemas live next to their owning module (`schemas/<entity>.schema.ts`).

## Connection

`DatabaseModule.forRootAsync(...)` reads `MongoDB_URI` and `MONGODB_DB_NAME` from config. Retry policy: 5 attempts, 2s apart. In non-production, `mongoose.set('debug', …)` logs every collection op.

## Schema patterns

```typescript
@Schema({ timestamps: true, collection: 'plural_noun' })
export class Foo {
  @Prop({ required: true, unique: true, index: true })
  someUniqueField!: string;
}

export const FooSchema = SchemaFactory.createForClass(Foo);
export type FooDocument = HydratedDocument<Foo>;

// Compound or option-bearing indexes:
FooSchema.index({ someField: 1, otherField: 1 }, { unique: true });
```

## Indexes

The project relies on indexes — `autoIndex: true` outside production, `false` in production (use `db.collection.createIndex` migration scripts when you go prod). Existing unique indexes worth knowing:

| Collection         | Index                                         |
| ------------------ | --------------------------------------------- |
| `users`            | `{ email: 1 }` partial-unique (only when `email` is a string; phone-only accounts excluded). `{ phone: 1 }` partial (uniqueness enforced in app layer) |
| `tenants`          | `{ tenantId: 1 }` unique                      |
| `products`         | `{ slug: 1 }` unique, text index on name/desc |
| `categories`       | `{ slug: 1 }` unique                          |
| `coupons`          | `{ code: 1 }` unique                          |
| `loyalty_accounts` | `{ tenantId: 1, userId: 1 }` unique           |
| `orders`           | `{ orderNumber: 1 }` unique                   |

## Migration strategy

The MVP does not ship a formal migration tool. Practical guidance:

- Additive schema changes (new optional field, new index) — safe to deploy as-is.
- Renames — write a one-off `ts-node` script under `src/database/migrations/` that runs against the live DB.
- Backfills — same: a script. Document under [Modifying a Schema](../ai/modifying-a-schema).

If migrations become frequent, adopt `migrate-mongo` and store scripts under `src/database/migrations/`.

## Lean reads

When you only need to return data (no mutation, no Mongoose virtuals), prefer `.lean().exec()` for ~50% faster fetches. The MVP uses raw documents in many places because the response shape is wrapped by `TransformInterceptor` and Mongoose timestamps are useful — measure before optimizing.
