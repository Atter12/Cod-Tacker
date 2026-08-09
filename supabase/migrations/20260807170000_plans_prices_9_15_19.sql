-- Self-serve plan display prices → $9 / $15 / $19 (monthly).
-- Annual ≈ 10× monthly (≈2 months free). Agency / Enterprise unchanged.
-- Stripe Price IDs are separate (STRIPE_PRICE_* / plan_provider_prices).

update public.plans
set
  monthly_price = 9,
  annual_price = 90,
  updated_at = now()
where code = 'starter';

update public.plans
set
  monthly_price = 15,
  annual_price = 150,
  updated_at = now()
where code = 'growth';

update public.plans
set
  monthly_price = 19,
  annual_price = 190,
  updated_at = now()
where code = 'scale';
