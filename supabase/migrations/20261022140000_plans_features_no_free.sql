-- Plan features after removing the free connector plan (see lib/billing/entitlements.ts).
--   Starter: store console (orders, ROAS / RTO, Flipy, attribution, alerts).
--   Growth:  + reconciliation, WhatsApp, automations.
--   Scale:   + conversions to Meta / TikTok, API, white label.
-- Agency / Enterprise keep everything.

update public.plans
set
  features = '{"reconciliation":false,"whatsapp":false,"automations":false,"conversions":false,"api":false,"white_label":false}'::jsonb,
  updated_at = now()
where code = 'starter';

update public.plans
set
  features = '{"reconciliation":true,"whatsapp":true,"automations":true,"conversions":false,"api":false,"white_label":false}'::jsonb,
  updated_at = now()
where code = 'growth';

update public.plans
set
  features = '{"reconciliation":true,"whatsapp":true,"automations":true,"conversions":true,"api":true,"white_label":true}'::jsonb,
  updated_at = now()
where code = 'scale';

update public.plans
set
  features = features || '{"reconciliation":true,"conversions":true}'::jsonb,
  updated_at = now()
where code in ('agency', 'enterprise');
