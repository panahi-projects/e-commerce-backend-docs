# Payments

Generic payment gateway abstraction. Default implementation is a mock; real gateways slot in behind the same interface.

## The interface

```typescript
// src/modules/payments/gateways/payment-gateway.interface.ts
export interface PaymentGateway {
  readonly name: string;
  createPaymentIntent(data: CreatePaymentIntentDto): Promise<PaymentIntentResult>;
  verifyPayment(reference: string, data?: unknown): Promise<PaymentVerificationResult>;
  processRefund(data: RefundDto): Promise<RefundResult>;
  handleWebhook(payload: unknown, signature: string): Promise<WebhookResult>;
}

export const PAYMENT_GATEWAY = 'PAYMENT_GATEWAY';
```

`PaymentsService` injects the active gateway via `@Inject(PAYMENT_GATEWAY)`. `PaymentsModule.register({ gateway: 'mock' })` in `AppModule` decides which concrete class binds to that token at boot. Today `SupportedGateway` is `'mock'` only — the mock is the sole implementation.

## The mock gateway

`src/modules/payments/gateways/mock/mock.gateway.ts` simulates a real provider: `createPaymentIntent` returns a generated `reference` and `redirectUrl`, then `verifyPayment` succeeds against the same reference. Useful for local dev and tests.

## Adding a real gateway

1. Create a new folder under `src/modules/payments/gateways/<provider>/`.
2. Write `provider.gateway.ts` implementing `PaymentGateway`.
3. Add the provider name to `SupportedGateway` in `payments.module.ts`.
4. Add the `if (options.gateway === '<name>')` branch in `PaymentsModule.register`.
5. Add provider-specific env vars (`STRIPE_API_KEY`, etc.) and validate them in `configuration.schema.ts`.
6. Switch `AppModule` to `PaymentsModule.register({ gateway: '<name>' })`.

## Webhook integration

Real gateways push asynchronous status updates. Add a webhook controller under `src/modules/payments/controllers/<provider>-webhook.controller.ts`, validate the signature with the provider's SDK, then call `PaymentsService` (or `OrdersService.markPaid` / `.markRefunded`) to apply the state change.

> [!WARNING]
> Webhook endpoints should be `@Public()` (no JWT) but must verify the provider's signature header. Never accept a webhook on faith.

## Refund flow

`OrdersService.requestRefund` marks the order `REFUND_REQUESTED`. The provider-specific refund logic lives in the gateway implementation; `OrdersService.markRefunded` is the terminal state.
