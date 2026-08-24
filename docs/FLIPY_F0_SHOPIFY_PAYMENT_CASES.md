# F0-1 — Casos Shopify → escenario Flipy

**Fase:** 0 Discovery · **Repo:** COD-tracked · **Validación:** `lib/integrations/flipy/resolve-payment.test.ts`

Casos sintéticos representativos del ICP COD Perú. Sustituir con export real de tienda piloto cuando esté disponible (misma estructura).

## Leyenda

| Campo | Significado |
| --- | --- |
| P | Monto producto (`subtotal_amount`) |
| F | Flete (`shipping_amount`) |
| Escenario | Sugerencia Flipy (`1A` prepago flete, `1E` COD efectivo default, etc.) |
| `cotizar` | `suggestedFlete = null` → cotizar en Flipy |

---

## Casos

| # | ID caso | Descripción | payment_kind | P | F | total | expected_cod | shipping_line | Resultado esperado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `cod-full-total` | COD clásico P+F | cod | 89 | 15 | 104 | 104 | Envío Lima | `delivery`, `1E`, cod=89, flete=15, high |
| 2 | `cod-product-only` | COD solo producto en checkout | cod | 120 | 12 | 132 | 120 | Envío | `delivery`, `1E`, cod=120, flete=cotizar, medium |
| 3 | `prepaid-shipping` | Prepago producto + flete online | prepaid | 75 | 18 | 93 | null | Envío | `delivery`, `1A`, cod=null, flete=18, high |
| 4 | `prepaid-free-shipping` | Prepago sin flete en checkout | prepaid | 55 | 0 | 55 | null | — | `delivery`, `1A`, confirm, flete=cotizar, medium |
| 5 | `pickup-recojo` | Recojo en tienda | cod | 40 | 0 | 40 | 40 | Recojo en tienda | `pickup`, sin escenario |
| 6 | `pickup-local` | Shopify Local Pickup | prepaid | 99 | 0 | 99 | null | Local Pickup | `pickup`, sin escenario |
| 7 | `cod-tag-wins` | Tag COD con gateway online | cod* | 60 | 10 | 70 | 70 | Envío | `delivery`, `1E`, cod=60, flete=10, high |
| 8 | `cod-discount-ambiguous` | Descuento rompe total | cod | 100 | 15 | 105 | 90 | Envío | `delivery`, `1E`, confirm, low |
| 9 | `prepaid-paid-financial` | Financial paid sin COD tag | prepaid | 45 | 8 | 53 | null | Envío | `delivery`, `1A`, cod=null, flete=8, high |
| 10 | `retiro-tienda` | Retiro en tienda (español) | cod | 30 | 0 | 30 | 30 | Retiro en tienda | `pickup`, sin escenario |

\* Caso 7: `payment_kind` ya resuelto a `cod` por `mapShopifyPayment` (tag COD gana).

---

## Escenarios Flipy (referencia)

| Escenario | Uso típico desde CT |
| --- | --- |
| **1A** | Producto y flete prepagados en Shopify |
| **1C** | COD; cliente paga P+F vía Yape al motorizado (elección usuario) |
| **1E** | COD; cliente paga P+F en efectivo (default sugerido) |
| **1D** | COD; cobro digital en rastreo Flipy |
| **GRATIS** | Fuera de alcance v1 Shopify |

Tras sugerencia automática, el modal Flipy (F2) permite override a 1A/1C/1E/1D con validaciones Flipy (tope Yape, etc.).

---

## Cómo revalidar con pedidos reales

1. Exportar 10 pedidos desde Shopify Admin o GraphQL (`orders` últimos 30 días, mix COD/prepago/recojo).
2. Anotar: `financial_status`, `tags`, `payment_gateway_names`, `subtotal`, `total_shipping`, `shipping_lines[].title`.
3. Comparar con salida de `resolveShopifyFlipyPayment()` en dev.
4. Actualizar esta tabla; marcar discrepancias en `FLIPY_INTEGRATION_GATES.md`.
