-- Sprint 6: attribution / campaigns / RTO aggregate RPCs (security invoker)
-- Additive only. Relies on existing RLS on underlying tables.

-- ---------------------------------------------------------------------------
-- Funnel by period (order status counts + revenue slices)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_store_order_funnel(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  orders_total bigint,
  confirmed bigint,
  shipped bigint,
  delivered bigint,
  rejected bigint,
  returned bigint,
  revenue_generated numeric,
  delivered_value numeric,
  collected_value numeric,
  settled_value numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::bigint as orders_total,
    count(*) filter (where o.confirmation_status = 'confirmed'
      or o.order_status in (
        'confirmed','ready_to_ship','shipped','in_transit','out_for_delivery','delivered'
      ))::bigint as confirmed,
    count(*) filter (where o.order_status in (
      'shipped','in_transit','out_for_delivery','delivered'
    ))::bigint as shipped,
    count(*) filter (where o.order_status = 'delivered')::bigint as delivered,
    count(*) filter (where o.order_status = 'rejected')::bigint as rejected,
    count(*) filter (where o.order_status = 'returned' or o.returned_at is not null)::bigint as returned,
    coalesce(sum(o.total_amount), 0)::numeric as revenue_generated,
    coalesce(sum(o.total_amount) filter (where o.order_status = 'delivered'), 0)::numeric as delivered_value,
    coalesce(sum(o.collected_cod_amount), 0)::numeric as collected_value,
    coalesce(sum(o.settled_cod_amount), 0)::numeric as settled_value
  from public.orders o
  where o.store_id = p_store_id
    and o.created_at >= p_from
    and o.created_at <= p_to;
$$;

revoke all on function public.rpc_store_order_funnel(uuid, timestamptz, timestamptz) from public;
grant execute on function public.rpc_store_order_funnel(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Hierarchical campaign performance (spend + attributed orders)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_store_campaign_performance(
  p_store_id uuid,
  p_from date,
  p_to date
)
returns table (
  campaign_id uuid,
  campaign_name text,
  platform public.ad_platform,
  spend numeric,
  impressions bigint,
  clicks bigint,
  orders_attributed bigint,
  revenue_generated numeric,
  delivered_value numeric,
  collected_value numeric,
  settled_value numeric,
  avg_confidence numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with spend as (
    select
      s.campaign_id,
      sum(s.spend)::numeric as spend,
      sum(s.impressions)::bigint as impressions,
      sum(s.clicks)::bigint as clicks
    from public.ad_spend_daily s
    where s.store_id = p_store_id
      and s.metric_date >= p_from
      and s.metric_date <= p_to
      and s.campaign_id is not null
    group by s.campaign_id
  ),
  attrs as (
    select
      oa.campaign_id,
      count(distinct oa.order_id)::bigint as orders_attributed,
      coalesce(sum(oa.attributed_value), 0)::numeric as revenue_generated,
      coalesce(avg(oa.credit), 0)::numeric as avg_confidence
    from public.order_attributions oa
    where oa.store_id = p_store_id
      and oa.campaign_id is not null
      and oa.calculated_at >= p_from::timestamptz
      and oa.calculated_at < (p_to + 1)::timestamptz
    group by oa.campaign_id
  ),
  order_values as (
    select
      oa.campaign_id,
      coalesce(sum(o.total_amount) filter (where o.order_status = 'delivered'), 0)::numeric as delivered_value,
      coalesce(sum(o.collected_cod_amount), 0)::numeric as collected_value,
      coalesce(sum(o.settled_cod_amount), 0)::numeric as settled_value
    from public.order_attributions oa
    join public.orders o on o.id = oa.order_id and o.store_id = oa.store_id
    where oa.store_id = p_store_id
      and oa.campaign_id is not null
      and oa.is_primary = true
      and oa.calculated_at >= p_from::timestamptz
      and oa.calculated_at < (p_to + 1)::timestamptz
    group by oa.campaign_id
  )
  select
    c.id as campaign_id,
    c.name as campaign_name,
    a.platform,
    coalesce(sp.spend, 0) as spend,
    coalesce(sp.impressions, 0) as impressions,
    coalesce(sp.clicks, 0) as clicks,
    coalesce(at.orders_attributed, 0) as orders_attributed,
    coalesce(at.revenue_generated, 0) as revenue_generated,
    coalesce(ov.delivered_value, 0) as delivered_value,
    coalesce(ov.collected_value, 0) as collected_value,
    coalesce(ov.settled_value, 0) as settled_value,
    coalesce(at.avg_confidence, 0) as avg_confidence
  from public.ad_campaigns c
  join public.ad_accounts a on a.id = c.ad_account_id
  left join spend sp on sp.campaign_id = c.id
  left join attrs at on at.campaign_id = c.id
  left join order_values ov on ov.campaign_id = c.id
  where c.store_id = p_store_id;
$$;

revoke all on function public.rpc_store_campaign_performance(uuid, date, date) from public;
grant execute on function public.rpc_store_campaign_performance(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- RTO breakdown by dimension
-- ---------------------------------------------------------------------------
create or replace function public.rpc_store_rto_breakdown(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_dimension text default 'city'
)
returns table (
  dimension_key text,
  dimension_label text,
  shipments_total bigint,
  rto_count bigint,
  delivered_count bigint,
  rto_rate numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select
      s.id,
      s.is_rto,
      s.status,
      s.carrier_id,
      o.shipping_city,
      o.shipping_district,
      o.total_amount,
      oa.campaign_id,
      case
        when o.total_amount < 50 then '0-49'
        when o.total_amount < 100 then '50-99'
        when o.total_amount < 200 then '100-199'
        else '200+'
      end as ticket_bucket,
      coalesce(
        (s.metadata ->> 'rejection_reason'),
        (s.metadata ->> 'rto_reason'),
        'unknown'
      ) as rejection_reason
    from public.shipments s
    left join public.orders o on o.id = s.order_id and o.store_id = s.store_id
    left join public.order_attributions oa
      on oa.order_id = s.order_id and oa.store_id = s.store_id and oa.is_primary = true
    where s.store_id = p_store_id
      and s.created_at >= p_from
      and s.created_at <= p_to
  ),
  keyed as (
    select
      case p_dimension
        when 'city' then coalesce(nullif(shipping_city, ''), 'Sin ciudad')
        when 'district' then coalesce(nullif(shipping_district, ''), 'Sin distrito')
        when 'carrier' then coalesce(carrier_id::text, 'Sin carrier')
        when 'campaign' then coalesce(campaign_id::text, 'unattributed')
        when 'ticket' then ticket_bucket
        when 'rejection_reason' then rejection_reason
        else coalesce(nullif(shipping_city, ''), 'Sin ciudad')
      end as dimension_key,
      *
    from base
  )
  select
    dimension_key,
    dimension_key as dimension_label,
    count(*)::bigint as shipments_total,
    count(*) filter (where is_rto or status = 'returned')::bigint as rto_count,
    count(*) filter (where status = 'delivered')::bigint as delivered_count,
    case
      when count(*) = 0 then 0
      else round(
        (count(*) filter (where is_rto or status = 'returned'))::numeric
        / count(*)::numeric,
        4
      )
    end as rto_rate
  from keyed
  group by dimension_key
  order by rto_count desc, shipments_total desc;
$$;

revoke all on function public.rpc_store_rto_breakdown(uuid, timestamptz, timestamptz, text) from public;
grant execute on function public.rpc_store_rto_breakdown(uuid, timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Daily spend + attributed revenue trend
-- ---------------------------------------------------------------------------
create or replace function public.rpc_store_ads_daily_trend(
  p_store_id uuid,
  p_from date,
  p_to date
)
returns table (
  metric_date date,
  spend numeric,
  attributed_revenue numeric,
  orders_attributed bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as metric_date
  ),
  spend as (
    select s.metric_date, sum(s.spend)::numeric as spend
    from public.ad_spend_daily s
    where s.store_id = p_store_id
      and s.metric_date >= p_from
      and s.metric_date <= p_to
    group by s.metric_date
  ),
  attrs as (
    select
      oa.calculated_at::date as metric_date,
      coalesce(sum(oa.attributed_value), 0)::numeric as attributed_revenue,
      count(distinct oa.order_id)::bigint as orders_attributed
    from public.order_attributions oa
    where oa.store_id = p_store_id
      and oa.calculated_at >= p_from::timestamptz
      and oa.calculated_at < (p_to + 1)::timestamptz
    group by oa.calculated_at::date
  )
  select
    d.metric_date,
    coalesce(s.spend, 0) as spend,
    coalesce(a.attributed_revenue, 0) as attributed_revenue,
    coalesce(a.orders_attributed, 0) as orders_attributed
  from days d
  left join spend s on s.metric_date = d.metric_date
  left join attrs a on a.metric_date = d.metric_date
  order by d.metric_date;
$$;

revoke all on function public.rpc_store_ads_daily_trend(uuid, date, date) from public;
grant execute on function public.rpc_store_ads_daily_trend(uuid, date, date) to authenticated;

comment on function public.rpc_store_order_funnel is
  'Sprint 6 SECURITY INVOKER funnel aggregates; RLS on orders still applies.';
comment on function public.rpc_store_campaign_performance is
  'Sprint 6 SECURITY INVOKER campaign performance; RLS on ads/attributions applies.';
comment on function public.rpc_store_rto_breakdown is
  'Sprint 6 SECURITY INVOKER RTO breakdown by dimension.';
comment on function public.rpc_store_ads_daily_trend is
  'Sprint 6 SECURITY INVOKER daily spend vs attributed revenue.';
