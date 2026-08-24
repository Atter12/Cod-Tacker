-- Flipy partner carrier + integration provider (F1 / PR-CT1-01)

DO $$
BEGIN
  ALTER TYPE public.integration_provider ADD VALUE IF NOT EXISTS 'flipy';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.carriers (
  code,
  name,
  country_codes,
  is_active,
  is_aggregator,
  supports_polling,
  supports_webhooks,
  metadata
)
SELECT
  'flipy',
  'Flipy',
  ARRAY['PE']::text[],
  true,
  false,
  false,
  true,
  '{"live": true, "partner": "codtracked", "docs": "docs/FLIPY_CODTRACKED_INTEGRATION_MASTER.md"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers WHERE code = 'flipy'
);

INSERT INTO public.carrier_status_mappings (
  carrier_id,
  external_status_code,
  external_status_label,
  normalized_status,
  is_rto,
  is_terminal,
  priority,
  is_active
)
SELECT
  c.id,
  m.external_status_code,
  m.external_status_label,
  m.normalized_status::public.shipment_status,
  m.is_rto,
  m.is_terminal,
  m.priority,
  true
FROM public.carriers c
CROSS JOIN (
  VALUES
    ('BORRADOR', 'Borrador', 'created', false, false, 0),
    ('PENDIENTE_PUJAS', 'Pendiente de pujas', 'created', false, false, 0),
    ('ASIGNADO', 'Asignado', 'label_generated', false, false, 0),
    ('EN_CURSO', 'En curso', 'in_transit', false, false, 0),
    ('ENTREGADO', 'Entregado', 'delivered', false, true, 10),
    ('CANCELADO', 'Cancelado', 'cancelled', false, true, 10)
) AS m (
  external_status_code,
  external_status_label,
  normalized_status,
  is_rto,
  is_terminal,
  priority
)
WHERE c.code = 'flipy'
  AND NOT EXISTS (
    SELECT 1
    FROM public.carrier_status_mappings existing
    WHERE existing.carrier_id = c.id
      AND existing.external_status_code = m.external_status_code
  );
