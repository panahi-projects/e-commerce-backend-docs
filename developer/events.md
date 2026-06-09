# Events

In-process pub/sub via `@nestjs/event-emitter` (`EventEmitter2`). Used to decouple core modules from plugins and plugins from each other.

## All event names

| Event                   | Emitted by                                 | Payload                                     | Consumed by                                                       |
| ----------------------- | ------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------- |
| `order.status-changed`  | `OrdersService.updateStatus`               | `{ orderId, orderNumber?, userId?, fromStatus, toStatus, actor?, tenantId }` | `NotificationsListener` — transactional SMS when `notifications.smsNotifications` is on |
| `order.cancelled`       | `OrdersService.cancelByCustomer`           | `{ orderId }`                               | (none yet)                                                        |
| `order.completed`       | `OrdersService.updateStatus` (→ COMPLETED) | `{ orderId, userId, total, tenantId }`      | `LoyaltyPointsService.handleOrderCompleted`                       |
| `review.approved`       | `ReviewsService.moderate` (→ APPROVED)     | `{ reviewId, userId, productId, tenantId }` | `LoyaltyPointsService.handleReviewApproved`                       |
| `tenant.config.changed` | `TenantsService` (every mutation)          | `{ tenantId }`                              | `FeatureFlagService.handleTenantConfigChanged` (invalidate cache) |
| `product.low-stock`     | `ProductsService.decrementStock` (stock ≤ threshold) | `{ productId, variantSku?, available, threshold }` | (mail processor / future notification plugin)                     |
| `payment.succeeded`     | `PaymentsService` (verify / webhook confirms) | `{ orderId, reference, amount, gateway }`   | (none yet)                                                        |
| `payment.failed`        | `PaymentsService` (verify / webhook fails) | `{ orderId, reference, amount, gateway }`   | (none yet)                                                        |
| `payment.refunded`      | `PaymentsService.refund`                   | `{ orderId, reference, amount, gateway }`   | (none yet)                                                        |
| `security.audit`        | `AuthService` / `UsersService` (security actions) | `{ tenantId, action, userId?, identifier?, ip?, userAgent?, meta? }` | `AuditLogsService.handleSecurityEvent` (when `auditLogs` enabled) |

The event constants are exported from `<module>/<module>.events.ts`.

## How to add an event

1. Add the constant + payload type to the emitting module's `<module>.events.ts`.
2. Emit it via `this.events.emit(EVENT_NAME, payload)` after the state change is durable.
3. Document it here.
4. Listeners use `@OnEvent(EVENT_NAME)` on a method — receivers must `import type` the payload to satisfy `isolatedModules` + `emitDecoratorMetadata`.

## Tenant context in events

Because event handlers run **outside** the request lifecycle, they cannot read `req.tenantId` from middleware. Producers must include `tenantId` in the payload (see `OrderCompletedEvent`, `ReviewApprovedEvent`, `TenantConfigChangedPayload`).

When tenantId is unknown at the producer side, fall back to `DEFAULT_TENANT_ID` from `src/common/middleware/tenant.middleware.ts` rather than emitting an event without it.

## Why events, not direct calls

- **Plugin isolation:** `OrdersService` does not know `LoyaltyPointsService` exists. If `loyaltyPoints` is disabled in `ENABLED_PLUGINS`, the listener simply doesn't subscribe — no errors, no missing-import problems.
- **Failure isolation:** a listener that throws does not break the producer's transaction.
- **Future microservice extraction:** the same event names work over `@nestjs/microservices` transports (TCP / NATS / Kafka). Today they're in-process; tomorrow they can cross a network boundary.
