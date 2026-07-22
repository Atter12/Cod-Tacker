-- Billing foundation for Stripe (and future gateways): price mapping + webhook idempotency.
-- Additive only. Does not change plans/subscriptions shape beyond supporting provider IDs already present.

-- ---------------------------------------------------------------------------
-- plan_provider_prices — maps local plans ↔ provider Price / Product IDs
-- ---------------------------------------------------------------------------
create table if not exists public.plan_provider_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  provider text not null,
  interval text not null,
  provider_price_id text not null,
  provider_product_id text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_provider_prices_provider_check
    check (provider in ('stripe', 'paddle', 'culqi', 'mercadopago', 'demo')),
  constraint plan_provider_prices_interval_check
    check (interval in ('month', 'year')),
  constraint plan_provider_prices_price_id_nonempty
    check (length(trim(provider_price_id)) > 0)
);

create unique index if not exists plan_provider_prices_plan_provider_interval_uidx
  on public.plan_provider_prices (plan_id, provider, interval)
  where is_active;

create unique index if not exists plan_provider_prices_provider_price_uidx
  on public.plan_provider_prices (provider, provider_price_id);

create index if not exists plan_provider_prices_provider_idx
  on public.plan_provider_prices (provider, is_active);

alter table public.plan_provider_prices enable row level security;

-- Catalog is readable by any authenticated user (Price IDs are not secrets).
drop policy if exists plan_provider_prices_select on public.plan_provider_prices;
create policy plan_provider_prices_select
  on public.plan_provider_prices for select to authenticated
  using (true);

-- Writes: platform admin only (Price IDs are ops-managed).
drop policy if exists plan_provider_prices_admin_write on public.plan_provider_prices;
create policy plan_provider_prices_admin_write
  on public.plan_provider_prices for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

comment on table public.plan_provider_prices is
  'Maps plans.code prices to Stripe/Paddle/etc Price IDs. Seed via ops; env STRIPE_PRICE_* is fallback.';

-- ---------------------------------------------------------------------------
-- billing_webhook_events — idempotent provider webhook intake
-- ---------------------------------------------------------------------------
create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  agency_id uuid references public.agencies (id) on delete set null,
  processed_at timestamptz,
  payload_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint billing_webhook_events_provider_check
    check (provider in ('stripe', 'paddle', 'culqi', 'mercadopago', 'demo')),
  constraint billing_webhook_events_event_id_nonempty
    check (length(trim(event_id)) > 0)
);

create unique index if not exists billing_webhook_events_provider_event_uidx
  on public.billing_webhook_events (provider, event_id);

create index if not exists billing_webhook_events_agency_idx
  on public.billing_webhook_events (agency_id, created_at desc);

alter table public.billing_webhook_events enable row level security;

-- No authenticated client access — service role only.
drop policy if exists billing_webhook_events_admin_select on public.billing_webhook_events;
create policy billing_webhook_events_admin_select
  on public.billing_webhook_events for select to authenticated
  using (public.is_platform_admin());

comment on table public.billing_webhook_events is
  'Idempotency ledger for billing webhooks (Stripe evt_…). Writes via service role.';
