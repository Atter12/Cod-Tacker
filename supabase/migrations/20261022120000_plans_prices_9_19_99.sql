-- Self-serve plan display prices → $9 / $19 / $99 (monthly).
-- Annual ≈ 10× monthly (≈2 months free). Agency / Enterprise unchanged.
-- Shopify App Pricing plans (Partner Dashboard) and Stripe Price IDs are configured outside the DB.

update public.plans
set
  monthly_price = 9,
  annual_price = 90,
  updated_at = now()
where code = 'starter';

update public.plans
set
  monthly_price = 19,
  annual_price = 190,
  updated_at = now()
where code = 'growth';

update public.plans
set
  monthly_price = 99,
  annual_price = 990,
  updated_at = now()
where code = 'scale';
