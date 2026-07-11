-- =============================================================================
-- CODTracked — audit de configuración (BD vs código)
-- Ejecutar en Supabase SQL Editor (o psql). Cada bloque es un result set independiente.
-- No modifica datos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Inventario: columnas de configuración (jsonb / settings / flags)
-- ---------------------------------------------------------------------------
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.column_default,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and (
    c.column_name in (
      'settings', 'metadata', 'features', 'conditions', 'actions',
      'targeting', 'payload', 'scopes', 'variables', 'raw_metrics',
      'artifact_summary', 'details', 'data', 'custom_data', 'user_data'
    )
    or c.column_name like '%settings%'
    or c.column_name like '%_enabled'
    or c.column_name like 'is_%'
    or c.column_name like '%_limit'
    or c.column_name like 'default_%'
  )
order by c.table_name, c.ordinal_position;

-- ---------------------------------------------------------------------------
-- 1) Enums públicos (valores permitidos en BD)
-- ---------------------------------------------------------------------------
select
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
order by t.typname, e.enumsortorder;

-- ---------------------------------------------------------------------------
-- 2) CHECK constraints (incluye status lists hardcodeados en SQL)
-- ---------------------------------------------------------------------------
select
  rel.relname as table_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public'
  and con.contype = 'c'
order by rel.relname, con.conname;

-- ---------------------------------------------------------------------------
-- 3) Catálogo de planes (fuente de verdad billing)
--    Código espera: starter 1/300, growth 3/1000, scale 5/5000, agency, enterprise
--    features: api, whatsapp, automations, white_label (+ custom_limits en enterprise)
-- ---------------------------------------------------------------------------
select
  code,
  name,
  monthly_price,
  annual_price,
  currency_code,
  store_limit,
  order_limit,
  is_active,
  is_public,
  features,
  features ? 'api' as has_api,
  features ? 'whatsapp' as has_whatsapp,
  features ? 'automations' as has_automations,
  features ? 'white_label' as has_white_label,
  features ? 'csv_import' as has_csv_import_legacy,
  features ? 'hide_branding' as has_hide_branding_legacy,
  updated_at
from public.plans
order by monthly_price nulls first, code;

-- Esperado vs actual (ajuste si cambias el catálogo canónico)
with expected(code, monthly_price, annual_price, store_limit, order_limit) as (
  values
    ('enterprise', 0::numeric, null::numeric, null::int, null::int),
    ('starter', 49::numeric, 470::numeric, 1, 300),
    ('growth', 79::numeric, 758::numeric, 3, 1000),
    ('scale', 189::numeric, 1814::numeric, 5, 5000),
    ('agency', 399::numeric, 3830::numeric, null::int, 20000)
)
select
  coalesce(e.code, p.code) as code,
  case
    when e.code is null then 'EXTRA_IN_DB'
    when p.code is null then 'MISSING_IN_DB'
    when p.monthly_price is distinct from e.monthly_price
      or p.annual_price is distinct from e.annual_price
      or p.store_limit is distinct from e.store_limit
      or p.order_limit is distinct from e.order_limit
      then 'MISMATCH'
    else 'OK'
  end as alignment,
  e.monthly_price as expected_monthly,
  p.monthly_price as actual_monthly,
  e.store_limit as expected_stores,
  p.store_limit as actual_stores,
  e.order_limit as expected_orders,
  p.order_limit as actual_orders,
  p.features as actual_features
from expected e
full outer join public.plans p on p.code = e.code
order by alignment, code;

-- ---------------------------------------------------------------------------
-- 4) Suscripciones por agencia
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  a.name as agency_name,
  a.is_active as agency_active,
  a.is_white_label_enabled,
  a.country_code,
  a.timezone,
  a.currency_code,
  a.settings as agency_settings,
  p.code as plan_code,
  s.status as subscription_status,
  s.trial_ends_at,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.billing_provider,
  s.metadata as subscription_metadata,
  s.metadata ? 'grace_period_ends_at' as has_grace_meta
from public.agencies a
left join lateral (
  select *
  from public.subscriptions s
  where s.agency_id = a.id
  order by s.created_at desc
  limit 1
) s on true
left join public.plans p on p.id = s.plan_id
order by a.slug;

-- Agencias sin suscripción (UI: límites soft starter)
select a.slug, a.name, a.is_active
from public.agencies a
where not exists (
  select 1 from public.subscriptions s where s.agency_id = a.id
)
order by a.slug;

-- ---------------------------------------------------------------------------
-- 5) White-label settings
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  a.is_white_label_enabled,
  w.product_name,
  w.logo_url is not null as has_logo,
  w.favicon_url is not null as has_favicon,
  w.primary_color,
  w.secondary_color,
  w.support_email,
  w.support_whatsapp,
  w.hide_codtracked_branding,
  w.metadata,
  coalesce(w.metadata->>'schema_version', 'missing') as wl_schema_version
from public.agencies a
left join public.white_label_settings w on w.agency_id = a.id
order by a.slug;

-- ---------------------------------------------------------------------------
-- 6) Tiendas: columnas de config + stores.settings (schema_version=1)
--    Código espera keys: schema_version, rto, cod, alerts, demo
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  st.slug as store_slug,
  st.name,
  st.is_active,
  st.country_code,
  st.timezone,
  st.currency_code,
  st.default_attribution_model,
  st.attribution_window_days,
  st.shopify_shop_domain,
  st.settings,
  coalesce(st.settings->>'schema_version', 'missing') as schema_version,
  st.settings ? 'rto' as has_rto,
  st.settings ? 'cod' as has_cod,
  st.settings ? 'alerts' as has_alerts,
  st.settings ? 'demo' as has_demo,
  -- keys no reconocidas (aprox.)
  (
    select coalesce(array_agg(k order by k), '{}')
    from jsonb_object_keys(coalesce(st.settings, '{}'::jsonb)) k
    where k not in ('schema_version', 'rto', 'cod', 'alerts', 'demo')
  ) as unknown_top_keys,
  st.settings->'rto' as rto,
  st.settings->'cod' as cod,
  st.settings->'alerts' as alerts,
  st.settings->'demo' as demo
from public.stores st
join public.agencies a on a.id = st.agency_id
order by a.slug, st.slug;

-- Resumen alineación store.settings
select
  count(*) as stores_total,
  count(*) filter (where coalesce(settings->>'schema_version', '') = '1') as schema_v1,
  count(*) filter (where settings = '{}'::jsonb or settings is null) as empty_settings,
  count(*) filter (where settings ? 'rto') as with_rto,
  count(*) filter (where settings ? 'cod') as with_cod,
  count(*) filter (where settings ? 'alerts') as with_alerts,
  count(*) filter (where settings ? 'demo') as with_demo
from public.stores;

-- ---------------------------------------------------------------------------
-- 7) Integraciones (settings/metadata por provider)
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  st.slug as store_slug,
  i.provider,
  i.status,
  i.display_name,
  i.external_account_id,
  i.scopes,
  i.settings,
  i.metadata,
  i.last_success_at,
  i.last_error_at,
  i.last_error_message
from public.integrations i
join public.agencies a on a.id = i.agency_id
left join public.stores st on st.id = i.store_id
order by a.slug, st.slug nulls first, i.provider;

select provider, status, count(*) 
from public.integrations
group by 1, 2
order by 1, 2;

-- ---------------------------------------------------------------------------
-- 8) Carriers + mappings (logística)
-- ---------------------------------------------------------------------------
select
  c.code,
  c.name,
  c.country_codes,
  c.supports_webhooks,
  c.supports_polling,
  c.is_aggregator,
  c.is_active,
  c.metadata,
  (select count(*) from public.carrier_status_mappings m where m.carrier_id = c.id and m.is_active) as active_mappings,
  (select count(*) from public.unmapped_carrier_statuses u where u.carrier_id = c.id) as unmapped_statuses
from public.carriers c
order by c.code;

select
  c.code as carrier_code,
  m.external_status_code,
  m.external_status_label,
  m.normalized_status,
  m.is_terminal,
  m.is_rto,
  m.priority,
  m.is_active
from public.carrier_status_mappings m
join public.carriers c on c.id = m.carrier_id
order by c.code, m.priority, m.external_status_code;

select
  c.code as carrier_code,
  a.slug as agency_slug,
  u.external_status_code,
  u.external_status_label,
  u.occurrence_count,
  u.last_seen_at
from public.unmapped_carrier_statuses u
join public.carriers c on c.id = u.carrier_id
left join public.agencies a on a.id = u.agency_id
order by u.occurrence_count desc, u.last_seen_at desc
limit 100;

-- Conexiones carrier por tenant
select
  a.slug as agency_slug,
  st.slug as store_slug,
  c.code as carrier_code,
  cc.status,
  cc.webhook_enabled,
  cc.polling_enabled,
  cc.polling_interval_minutes,
  cc.settings,
  cc.last_success_at,
  cc.last_error_message
from public.carrier_connections cc
join public.agencies a on a.id = cc.agency_id
join public.carriers c on c.id = cc.carrier_id
left join public.stores st on st.id = cc.store_id
order by a.slug, st.slug nulls first, c.code;

-- ---------------------------------------------------------------------------
-- 9) WhatsApp templates
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  st.slug as store_slug,
  t.name,
  t.language,
  t.category,
  t.status,
  t.is_active,
  t.variables,
  left(t.body, 120) as body_preview,
  t.metadata
from public.whatsapp_templates t
join public.agencies a on a.id = t.agency_id
left join public.stores st on st.id = t.store_id
order by a.slug, t.status, t.name;

select status, is_active, count(*)
from public.whatsapp_templates
group by 1, 2
order by 1, 2;

-- ---------------------------------------------------------------------------
-- 10) Automatizaciones (shape de conditions/actions)
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  st.slug as store_slug,
  r.name,
  r.trigger_type,
  r.is_active,
  r.priority,
  r.requires_manual_approval,
  r.cooldown_minutes,
  r.conditions,
  r.actions,
  jsonb_typeof(r.actions) as actions_type,
  r.last_triggered_at
from public.automation_rules r
join public.agencies a on a.id = r.agency_id
left join public.stores st on st.id = r.store_id
order by a.slug, r.priority, r.name;

select trigger_type, is_active, count(*)
from public.automation_rules
group by 1, 2
order by 1, 2;

-- ---------------------------------------------------------------------------
-- 11) Usage / billing satélites
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  st.slug as store_slug,
  u.metric,
  u.period_key,
  u.quantity,
  u.updated_at,
  u.metadata
from public.usage_counters u
join public.agencies a on a.id = u.agency_id
left join public.stores st on st.id = u.store_id
order by u.period_key desc, a.slug, u.metric
limit 200;

select metric, count(*), sum(quantity) as total_qty
from public.usage_counters
group by 1
order by 1;

select
  a.slug as agency_slug,
  i.invoice_number,
  i.status,
  i.currency_code,
  i.amount_cents,
  i.period_start,
  i.period_end,
  i.issued_at,
  i.metadata
from public.invoice_records i
join public.agencies a on a.id = i.agency_id
order by i.issued_at desc
limit 100;

-- ---------------------------------------------------------------------------
-- 12) API keys (scopes / status — sin hashes)
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  st.slug as store_slug,
  k.name,
  k.key_prefix,
  k.scopes,
  k.status,
  k.expires_at,
  k.revoked_at,
  k.last_used_at,
  k.created_at
from public.api_keys k
join public.agencies a on a.id = k.agency_id
left join public.stores st on st.id = k.store_id
order by a.slug, k.created_at desc;

-- ---------------------------------------------------------------------------
-- 13) Privacidad
-- ---------------------------------------------------------------------------
select
  a.slug as agency_slug,
  st.slug as store_slug,
  e.scope,
  e.status,
  e.artifact_summary,
  e.error_message,
  e.created_at,
  e.completed_at
from public.data_export_requests e
join public.agencies a on a.id = e.agency_id
left join public.stores st on st.id = e.store_id
order by e.created_at desc
limit 50;

select
  a.slug as agency_slug,
  st.slug as store_slug,
  d.scope,
  d.status,
  d.reason,
  d.review_notes,
  d.created_at,
  d.reviewed_at
from public.data_deletion_requests d
join public.agencies a on a.id = d.agency_id
left join public.stores st on st.id = d.store_id
order by d.created_at desc
limit 50;

-- ---------------------------------------------------------------------------
-- 14) Conteos globales (salud del dataset)
-- ---------------------------------------------------------------------------
select 'agencies' as entity, count(*) from public.agencies
union all select 'stores', count(*) from public.stores
union all select 'plans', count(*) from public.plans
union all select 'subscriptions', count(*) from public.subscriptions
union all select 'integrations', count(*) from public.integrations
union all select 'carriers', count(*) from public.carriers
union all select 'carrier_status_mappings', count(*) from public.carrier_status_mappings
union all select 'unmapped_carrier_statuses', count(*) from public.unmapped_carrier_statuses
union all select 'automation_rules', count(*) from public.automation_rules
union all select 'alerts', count(*) from public.alerts
union all select 'whatsapp_templates', count(*) from public.whatsapp_templates
union all select 'api_keys', count(*) from public.api_keys
union all select 'invoice_records', count(*) from public.invoice_records
union all select 'usage_counters', count(*) from public.usage_counters
union all select 'orders', count(*) from public.orders
union all select 'shipments', count(*) from public.shipments
union all select 'background_jobs', count(*) from public.background_jobs
union all select 'sync_runs', count(*) from public.sync_runs
order by 1;

-- ---------------------------------------------------------------------------
-- 15) Defaults de columna (comparar con defaults del código)
-- ---------------------------------------------------------------------------
select
  table_name,
  column_name,
  column_default,
  data_type
from information_schema.columns
where table_schema = 'public'
  and column_default is not null
  and table_name in (
    'profiles', 'agencies', 'stores', 'plans', 'subscriptions',
    'white_label_settings', 'integrations', 'carriers', 'carrier_connections',
    'automation_rules', 'alerts', 'whatsapp_templates', 'whatsapp_conversations'
  )
order by table_name, ordinal_position;
