-- Canonical plan catalog (DB is source of truth for billing limits/features).
-- Converges environments that received an older Sprint 9 seed.

create unique index if not exists plans_code_uidx on public.plans (code);

insert into public.plans (
  code, name, monthly_price, annual_price, currency_code,
  store_limit, order_limit, features, is_active, is_public
)
values
  (
    'enterprise', 'Enterprise', 0, null, 'USD',
    null, null,
    '{"api":true,"whatsapp":true,"automations":true,"white_label":true,"custom_limits":true}'::jsonb,
    true, true
  ),
  (
    'starter', 'Starter', 49, 470, 'USD',
    1, 300,
    '{"api":false,"whatsapp":false,"automations":false,"white_label":false}'::jsonb,
    true, true
  ),
  (
    'growth', 'Growth', 79, 758, 'USD',
    3, 1000,
    '{"api":false,"whatsapp":true,"automations":true,"white_label":false}'::jsonb,
    true, true
  ),
  (
    'scale', 'Scale', 189, 1814, 'USD',
    5, 5000,
    '{"api":true,"whatsapp":true,"automations":true,"white_label":false}'::jsonb,
    true, true
  ),
  (
    'agency', 'Agency', 399, 3830, 'USD',
    null, 20000,
    '{"api":true,"whatsapp":true,"automations":true,"white_label":true}'::jsonb,
    true, true
  )
on conflict (code) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  currency_code = excluded.currency_code,
  store_limit = excluded.store_limit,
  order_limit = excluded.order_limit,
  features = excluded.features,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  updated_at = now();
