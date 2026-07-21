-- Inject Meta ad spend into ad_spend_daily for S16 dashboard demo.
-- Run in Supabase SQL Editor (service role / postgres).
--
-- 1) Adjust slugs below to match your agency/store URL:
--    /a/<agency_slug>/s/<store_slug>/...
-- 2) Optionally set v_spend_per_day and currency.
-- 3) Run; then open Dashboard in the last 7 days range.

do $$
declare
  -- >>> EDIT THESE <<<
  v_agency_slug text := 'holistic-ecommerce';  -- change if needed
  v_store_slug  text := 'flipy';               -- change if needed
  v_spend_per_day numeric := 150.00;
  v_currency text := 'PEN';
  -- >>> END EDIT <<<

  v_agency_id uuid;
  v_store_id uuid;
  v_integration_id uuid;
  v_external_account_id text;
  v_ad_account_id uuid;
  v_day date;
  v_i int;
begin
  select a.id into v_agency_id
  from public.agencies a
  where a.slug = v_agency_slug
  limit 1;

  if v_agency_id is null then
    raise exception 'Agency slug not found: %. List with: select slug, name from agencies;', v_agency_slug;
  end if;

  select s.id into v_store_id
  from public.stores s
  where s.agency_id = v_agency_id
    and s.slug = v_store_slug
  limit 1;

  if v_store_id is null then
    raise exception 'Store slug not found: % (agency %). List with: select slug, name from stores where agency_id = %;',
      v_store_slug, v_agency_slug, v_agency_id;
  end if;

  select i.id,
         coalesce(
           nullif(i.external_account_id, ''),
           nullif(i.settings->>'ad_account_id', ''),
           nullif(i.metadata->>'ad_account_id', ''),
           'act_inject_demo'
         )
  into v_integration_id, v_external_account_id
  from public.integrations i
  where i.agency_id = v_agency_id
    and i.store_id = v_store_id
    and i.provider = 'meta'
  order by case when i.status = 'connected' then 0 else 1 end, i.updated_at desc
  limit 1;

  if v_integration_id is null then
    raise exception 'No Meta integration for store %. Connect Meta Ads first.', v_store_slug;
  end if;

  -- Prefer existing ad_account for this integration + external id
  select aa.id into v_ad_account_id
  from public.ad_accounts aa
  where aa.agency_id = v_agency_id
    and aa.store_id = v_store_id
    and aa.integration_id = v_integration_id
    and aa.external_account_id = v_external_account_id
  limit 1;

  if v_ad_account_id is null then
    insert into public.ad_accounts (
      agency_id,
      store_id,
      integration_id,
      platform,
      external_account_id,
      name,
      currency_code,
      is_active,
      metadata
    )
    values (
      v_agency_id,
      v_store_id,
      v_integration_id,
      'meta',
      v_external_account_id,
      'Meta Ads · inject',
      v_currency,
      true,
      jsonb_build_object(
        'demo', true,
        'mode', 'live',
        'source', 'manual_sql_inject'
      )
    )
    returning id into v_ad_account_id;
  end if;

  -- Upsert last 7 days (today inclusive) so default dashboard range shows spend
  for v_i in 0..6 loop
    v_day := (timezone('utc', now())::date - v_i);

    update public.ad_spend_daily s
    set
      spend = v_spend_per_day,
      impressions = 5000,
      clicks = 200,
      currency_code = v_currency,
      raw_metrics = jsonb_build_object(
        'demo', true,
        'mode', 'live',
        'source', 'manual_sql_inject',
        'injected_at', now()
      )
    where s.ad_account_id = v_ad_account_id
      and s.metric_date = v_day
      and s.platform = 'meta'
      and s.store_id = v_store_id;

    if not found then
      insert into public.ad_spend_daily (
        agency_id,
        store_id,
        ad_account_id,
        platform,
        metric_date,
        spend,
        impressions,
        clicks,
        currency_code,
        platform_conversions,
        platform_conversion_value,
        raw_metrics
      )
      values (
        v_agency_id,
        v_store_id,
        v_ad_account_id,
        'meta',
        v_day,
        v_spend_per_day,
        5000,
        200,
        v_currency,
        0,
        0,
        jsonb_build_object(
          'demo', true,
          'mode', 'live',
          'source', 'manual_sql_inject',
          'injected_at', now()
        )
      );
    end if;
  end loop;

  raise notice 'OK: injected %/day x 7 days for agency=% store=% ad_account=% external=%',
    v_spend_per_day, v_agency_slug, v_store_slug, v_ad_account_id, v_external_account_id;
end $$;

-- Verify
select
  s.metric_date,
  s.spend,
  s.currency_code,
  s.raw_metrics->>'source' as source,
  aa.external_account_id
from public.ad_spend_daily s
join public.ad_accounts aa on aa.id = s.ad_account_id
join public.stores st on st.id = s.store_id
join public.agencies ag on ag.id = s.agency_id
where ag.slug = 'holistic-ecommerce'   -- same slugs as above
  and st.slug = 'flipy'
  and s.platform = 'meta'
order by s.metric_date desc
limit 14;
