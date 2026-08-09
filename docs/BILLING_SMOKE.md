# Billing smoke checklist (Stripe)

Use after applying `20260722160000_billing_stripe_foundation.sql` and setting `BILLING_PROVIDER=stripe`.

## Prerequisites

- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` on the server (live)
- [ ] Price IDs for Starter/Growth/Scale (month + year) in `plan_provider_prices` **or** `STRIPE_PRICE_*` env
- [ ] Stripe webhook endpoint: `{NEXT_PUBLIC_APP_URL}/api/billing/webhooks/stripe`
- [ ] Events enabled: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.finalized`, `invoice.payment_failed`
- [ ] Job worker / cron draining (`/api/internal/jobs/process`)

## Stripe test mode (allowlisted toggle)

For `sandrowonmer@gmail.com` (or `STRIPE_TEST_MODE_ALLOWED_EMAILS`):

- [ ] `STRIPE_TEST_SECRET_KEY=sk_test_…`
- [ ] `STRIPE_TEST_WEBHOOK_SECRET=whsec_…` (Test mode endpoint → same URL)
- [ ] `STRIPE_TEST_PRICE_STARTER_MONTH` / `_YEAR` (also GROWTH, SCALE)
- [ ] Redeploy after adding envs
- [ ] In Facturación, enable **Modo test** → Checkout with `4242…`
- [ ] Prefer a non-production agency (blocked if agency already has a live Stripe sub)

## Happy path

1. Agency owner opens **Facturación**, toggles **Mensual / Anual**.
2. Clicks **Comenzar ahora** on Growth → redirects to Stripe Checkout.
3. Pays with test card `4242…`.
4. Lands on `?checkout=success`; within seconds (webhook + job):
   - subscription `status=active`, `billing_provider=stripe`
   - `provider_customer_id` / `provider_subscription_id` set
   - invoice row appears in Historial
5. **Portal de facturación** opens Stripe Customer Portal.

## Past due

1. In Stripe test mode, fail the next invoice (or use a declining card).
2. Expect `invoice.payment_failed` → subscription `past_due` + `metadata.past_due_since`.
3. UI shows payment warning; create-store / CSV still work during **7-day** grace.
4. After grace, mutations throw (access blocked); Portal still reachable to fix payment.
5. Successful `invoice.paid` clears `past_due` / restores `active`.

## Cancel / grace

1. **Programar cancelación** → Stripe `cancel_at_period_end=true` (or Portal cancel).
2. Access remains while period active / cancel grace.
3. After cancel + grace expiry, store create / CSV import blocked.

## Idempotency

1. Replay the same Stripe event (`evt_…`) via Dashboard “Resend”.
2. Expect HTTP 200 `{ duplicate: true }` (or `duplicate_job`) and **no** second invoice / subscription row.

## Regression (demo)

- With `BILLING_PROVIDER=demo`, plan select still applies locally without Stripe keys.
