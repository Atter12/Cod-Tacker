-- =============================================================================
-- CODTracked — Auditoría BD para migraciones post sprints Shopify A→D
-- =============================================================================
-- Objetivo: ver qué constraints/índices YA existen, qué columnas faltan,
-- y si hay duplicados que impedirían crear UNIQUE antes de migrar.
--
-- Cómo usar: pegar en Supabase → SQL Editor (producción o staging).
-- Cada bloque es independiente; ejecuta todos o por sección.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Resumen rápido: tablas clave de A–D ¿existen?
-- -----------------------------------------------------------------------------
select t.table_name,
       case when t.table_name is not null then 'ok' else 'MISSING' end as status
from (
  values
    ('customers'),
    ('orders'),
    ('order_items'),
    ('products'),
    ('product_variants'),
    ('stores'),
    ('integrations')
) as needed(table_name)
left join information_schema.tables t
  on t.table_schema = 'public'
 and t.table_name = needed.table_name
order by needed.table_name;

-- -----------------------------------------------------------------------------
-- 1) Columnas que el código A–D escribe/lee (¿existen y nullability?)
-- -----------------------------------------------------------------------------
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and (
    (c.table_name = 'customers' and c.column_name in (
      'id', 'store_id', 'external_customer_id', 'email', 'phone',
      'first_name', 'last_name', 'country_code', 'city', 'region', 'postal_code', 'metadata'
    ))
    or (c.table_name = 'orders' and c.column_name in (
      'id', 'store_id', 'customer_id', 'external_order_id',
      'payment_status', 'expected_cod_amount', 'collected_cod_amount', 'settled_cod_amount',
      'shipping_country_code', 'shipping_region', 'shipping_city', 'shipping_district', 'shipping_postal_code',
      'metadata', 'tags'
    ))
    or (c.table_name = 'order_items' and c.column_name in (
      'id', 'order_id', 'store_id', 'product_id', 'variant_id',
      'external_line_item_id', 'sku', 'title', 'quantity',
      'unit_price', 'total_discount', 'total_price', 'metadata'
    ))
    or (c.table_name = 'products' and c.column_name in (
      'id', 'store_id', 'external_product_id', 'title', 'vendor', 'image_url', 'metadata'
    ))
    or (c.table_name = 'product_variants' and c.column_name in (
      'id', 'product_id', 'store_id', 'external_variant_id', 'sku', 'title', 'price', 'metadata'
    ))
    or (c.table_name = 'stores' and c.column_name in (
      'id', 'agency_id', 'shopify_shop_domain'
    ))
    or (c.table_name = 'integrations' and c.column_name in (
      'id', 'provider', 'status', 'secret_reference', 'metadata', 'settings'
    ))
  )
order by c.table_name, c.column_name;

-- -----------------------------------------------------------------------------
-- 2) UNIQUE / PRIMARY / indexes actuales en tablas A–D
--    (aquí confirmas si ya hay unique para upsert)
-- -----------------------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  i.relname as index_name,
  ix.indisunique as is_unique,
  ix.indisprimary as is_primary,
  pg_get_indexdef(ix.indexrelid) as index_def
from pg_index ix
join pg_class c on c.oid = ix.indrelid
join pg_class i on i.oid = ix.indexrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'customers', 'orders', 'order_items', 'products', 'product_variants', 'stores', 'integrations'
  )
order by c.relname, ix.indisprimary desc, ix.indisunique desc, i.relname;

-- Constraints UNIQUE / PK / FK nombradas
select
  tc.table_name,
  tc.constraint_type,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' order by kcu.ordinal_position) as columns
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name
 and kcu.table_schema = tc.table_schema
 and kcu.table_name = tc.table_name
where tc.table_schema = 'public'
  and tc.table_name in (
    'customers', 'orders', 'order_items', 'products', 'product_variants', 'stores', 'integrations'
  )
  and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
group by tc.table_name, tc.constraint_type, tc.constraint_name
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- -----------------------------------------------------------------------------
-- 3) Duplicados que BLOQUEARÍAN crear los UNIQUE recomendados
--    (si count > 0 → hay que dedupe antes de migrar)
-- -----------------------------------------------------------------------------

-- Sprint A: customers (store_id, external_customer_id) WHERE NOT NULL
select
  'customers.external_customer_id' as check_name,
  store_id,
  external_customer_id,
  count(*) as dup_count,
  array_agg(id order by created_at) as ids
from public.customers
where external_customer_id is not null
group by store_id, external_customer_id
having count(*) > 1
order by dup_count desc
limit 50;

-- Opcional A (si más adelante se indexa email): emails duplicados por tienda
select
  'customers.email' as check_name,
  store_id,
  email::text as email,
  count(*) as dup_count,
  array_agg(id order by created_at) as ids
from public.customers
where email is not null
group by store_id, email
having count(*) > 1
order by dup_count desc
limit 50;

-- Opcional A: phones duplicados por tienda
select
  'customers.phone' as check_name,
  store_id,
  phone,
  count(*) as dup_count,
  array_agg(id order by created_at) as ids
from public.customers
where phone is not null and length(trim(phone)) > 0
group by store_id, phone
having count(*) > 1
order by dup_count desc
limit 50;

-- Sprint B: products (store_id, external_product_id)
select
  'products.external_product_id' as check_name,
  store_id,
  external_product_id,
  count(*) as dup_count,
  array_agg(id order by created_at) as ids
from public.products
group by store_id, external_product_id
having count(*) > 1
order by dup_count desc
limit 50;

-- Sprint B: product_variants (store_id, external_variant_id)
select
  'product_variants.external_variant_id' as check_name,
  store_id,
  external_variant_id,
  count(*) as dup_count,
  array_agg(id order by created_at) as ids
from public.product_variants
group by store_id, external_variant_id
having count(*) > 1
order by dup_count desc
limit 50;

-- Sprint B: order_items (order_id, external_line_item_id) WHERE NOT NULL
select
  'order_items.external_line_item_id' as check_name,
  order_id,
  external_line_item_id,
  count(*) as dup_count,
  array_agg(id order by created_at) as ids
from public.order_items
where external_line_item_id is not null
group by order_id, external_line_item_id
having count(*) > 1
order by dup_count desc
limit 50;

-- orders.external_order_id por store (debería existir unique; verificar)
select
  'orders.external_order_id' as check_name,
  store_id,
  external_order_id,
  count(*) as dup_count,
  array_agg(id order by created_at) as ids
from public.orders
group by store_id, external_order_id
having count(*) > 1
order by dup_count desc
limit 50;

-- Sprint D: stores.shopify_shop_domain unique (ya suele existir; detectar dups null-safe)
select
  'stores.shopify_shop_domain' as check_name,
  shopify_shop_domain::text as shopify_shop_domain,
  count(*) as dup_count,
  array_agg(id) as ids
from public.stores
where shopify_shop_domain is not null
group by shopify_shop_domain
having count(*) > 1
order by dup_count desc
limit 50;

-- -----------------------------------------------------------------------------
-- 4) Checklist automático: ¿faltan los índices que A–D recomiendan?
-- -----------------------------------------------------------------------------
with wanted as (
  select * from (values
    -- Sprint A
    ('customers', 'store_id, external_customer_id', 'partial on external_customer_id IS NOT NULL'),
    -- Sprint B
    ('products', 'store_id, external_product_id', 'unique full'),
    ('product_variants', 'store_id, external_variant_id', 'unique full'),
    ('order_items', 'order_id, external_line_item_id', 'partial on external_line_item_id IS NOT NULL'),
    -- Ya esperado (sanity)
    ('orders', 'store_id, external_order_id', 'unique full'),
    ('stores', 'shopify_shop_domain', 'unique (nullable ok in PG)')
  ) as v(table_name, columns_hint, notes)
),
existing as (
  select
    c.relname as table_name,
    i.relname as index_name,
    lower(pg_get_indexdef(ix.indexrelid)) as index_def,
    ix.indisunique as is_unique
  from pg_index ix
  join pg_class c on c.oid = ix.indrelid
  join pg_class i on i.oid = ix.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('customers', 'products', 'product_variants', 'order_items', 'orders', 'stores')
    and ix.indisunique
)
select
  w.table_name,
  w.columns_hint,
  w.notes,
  coalesce(
    (
      select string_agg(e.index_name, ', ')
      from existing e
      where e.table_name = w.table_name
        and e.index_def like '%' || split_part(replace(w.columns_hint, ' ', ''), ',', 1) || '%'
        and (
          -- rough match on second column when present
          position(',' in w.columns_hint) = 0
          or e.index_def like '%' || trim(split_part(w.columns_hint, ',', 2)) || '%'
        )
    ),
    'MISSING — candidato a migración'
  ) as matching_unique_indexes
from wanted w
order by w.table_name;

-- -----------------------------------------------------------------------------
-- 5) Enums de pago (Sprint C) — confirmar valores disponibles
-- -----------------------------------------------------------------------------
select
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname = 'payment_status'
order by e.enumsortorder;

-- Distribución actual (¿cuántos Shopify ya están mal como cash_expected?)
select
  o.payment_status,
  o.source_name,
  count(*) as orders_count,
  count(*) filter (where o.expected_cod_amount is null) as expected_cod_null,
  count(*) filter (where o.expected_cod_amount is not null) as expected_cod_set
from public.orders o
group by o.payment_status, o.source_name
order by orders_count desc;

-- -----------------------------------------------------------------------------
-- 6) Sprint D — nullability de shopify_shop_domain + filas con dominio huérfano
--    (dominio seteado pero integración shopify disconnected)
-- -----------------------------------------------------------------------------
select
  column_name,
  is_nullable,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'stores'
  and column_name = 'shopify_shop_domain';

select
  s.id as store_id,
  s.slug,
  s.shopify_shop_domain::text as shopify_shop_domain,
  i.id as integration_id,
  i.status as integration_status
from public.stores s
left join public.integrations i
  on i.store_id = s.id
 and i.provider = 'shopify'
where s.shopify_shop_domain is not null
  and (i.id is null or i.status in ('disconnected', 'revoked'))
order by s.updated_at desc
limit 50;

-- =============================================================================
-- Guías de interpretación (migración sugerida)
-- =============================================================================
-- Sprint A
--   Si MISSING unique (store_id, external_customer_id) AND duplicados = 0:
--     create unique index customers_store_external_uidx
--       on public.customers (store_id, external_customer_id)
--       where external_customer_id is not null;
--   Email/phone unique: OPCIONAL (más agresivo; solo si dups = 0 y producto lo pide).
--
-- Sprint B
--   Si MISSING:
--     create unique index products_store_external_uidx
--       on public.products (store_id, external_product_id);
--     create unique index product_variants_store_external_uidx
--       on public.product_variants (store_id, external_variant_id);
--     create unique index order_items_order_external_uidx
--       on public.order_items (order_id, external_line_item_id)
--       where external_line_item_id is not null;
--
-- Sprint C
--   NO requiere enum nuevo: prepaid = unpaid + expected_cod_amount null.
--   Solo revisar que payment_status tenga unpaid/cash_expected/refunded.
--   Migración de DATOS opcional: corregir pedidos Shopify prepaid históricos
--   mal marcados cash_expected (decisión de producto, no schema).
--
-- Sprint D
--   shopify_shop_domain debe ser nullable + UNIQUE.
--   Si NOT NULL → migración alter column drop not null.
--   Si hay dominios huérfanos con integración disconnected → limpia operativa o
--   one-shot update set shopify_shop_domain = null where ...
-- =============================================================================
