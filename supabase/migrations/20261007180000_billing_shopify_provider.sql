-- Allow Shopify App Pricing as a billing provider alongside Stripe.
-- plan_provider_prices.provider_price_id stores the Partner plan_handle for provider = shopify.

alter table public.plan_provider_prices
  drop constraint if exists plan_provider_prices_provider_check;

alter table public.plan_provider_prices
  add constraint plan_provider_prices_provider_check
  check (provider in ('stripe', 'paddle', 'culqi', 'mercadopago', 'demo', 'shopify'));

alter table public.billing_webhook_events
  drop constraint if exists billing_webhook_events_provider_check;

alter table public.billing_webhook_events
  add constraint billing_webhook_events_provider_check
  check (provider in ('stripe', 'paddle', 'culqi', 'mercadopago', 'demo', 'shopify'));

comment on table public.plan_provider_prices is
  'Maps plans.code to provider Price IDs (Stripe) or plan_handle (Shopify App Pricing). Seed via ops; env STRIPE_PRICE_* / SHOPIFY_PLAN_HANDLE_* are fallbacks.';
