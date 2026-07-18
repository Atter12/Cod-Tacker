# CODTracked — visión de producto y módulos

Documento para alinear pitch, demos y validación con empresas. Fuente de verdad de navegación: `config/navigation.ts`. Catálogo de integraciones: `lib/integrations/catalog.ts`.

---

## 1. Qué es CODTracked (en una frase)

Capa de **verdad económica y operación** para tiendas **Shopify COD en LATAM**: mide lo que se confirmó, entregó, devolvió y cobró en puerta, para que el ROAS refleje **cash real**, no el Purchase del checkout.

No compite como “otro tracker de ads”. Compite como sistema de registro del ciclo COD.

---

## 2. Flujo cerrado de ventas (loop COD)

El valor del producto aparece cuando se cierran estas etapas:

```
Publicidad (ads)
    → Pedido en e-commerce (commerce)
        → Confirmación por mensajería (messaging)
            → Entrega / RTO por courier (carrier)
                → Cobro y conciliación (settlement)
                    → Conversión terminal a ads (CAPI / Events)
```

| Etapa | Qué aporta a CODTracked | Métrica / outcome |
| --- | --- | --- |
| Publicidad | Gasto, campaña, ad set, ad; click IDs / UTMs | ROAS por creative |
| E-commerce | Pedido, cliente, ítems, COD vs prepaid | Pedidos generados |
| Mensajería | Confirmación / rechazo del pedido | Tasa de confirmación |
| Courier | Estados de envío normalizados | Entregados, RTO |
| Conciliación | Cash cobrado vs esperado | ROAS sobre cobrado |
| Conversión terminal | Evento a Meta/TikTok solo cuando hay cash real | Optimización limpia |

Sin courier + cash, el “Purchase” de checkout sigue contaminando el ad account. CODTracked existe para cerrar ese gap.

---

## 3. Clasificación de integraciones

Cada proveedor del catálogo pertenece a un **rol** (`IntegrationProviderKind`) en el flujo cerrado.

| Rol (`kind`) | Etiqueta UI | Función en el loop | Proveedores actuales |
| --- | --- | --- | --- |
| `ads` | Publicidad | Gasto + jerarquía de campañas; destino de conversiones | Meta Ads, TikTok Ads |
| `commerce` | E-commerce | Fuente de pedidos, clientes, catálogo, señal de pago | Shopify |
| `messaging` | Mensajería | Confirmación COD y operación conversacional | WhatsApp Business |
| `carrier` | Courier / logística | Tracking, entregado, fallido, RTO | Enviame, Carrier personalizado |
| `settlement` | Cobro / conciliación | Lotes de cobro, match pedido↔cash | Pagos y conciliación |

### Matriz rápida (proveedor → rol → aporta)

| Proveedor | Rol | Aporta al loop |
| --- | --- | --- |
| **Shopify** | E-commerce | Pedidos, clientes, line items, COD vs prepaid |
| **Meta Ads** | Publicidad | Spend, campaigns; CAPI Purchase terminal |
| **TikTok Ads** | Publicidad | Spend / campañas; Events API (roadmap) |
| **WhatsApp Business** | Mensajería | Confirmaciones y conversaciones COD |
| **Enviame** | Courier | Estados de envío → entregado / RTO |
| **Envia.com** | Courier | Multi-carrier + webhook `onShipmentStatusUpdate` |
| **Carrier personalizado** | Courier | Mismo contrato, otro operador |
| **Pagos y conciliación** | Cobro | Batches CSV / settlement → cash cerrado |

Orden canónico del flujo en código: `INTEGRATION_KIND_FLOW_ORDER` en `lib/integrations/catalog.ts`  
(`ads` → `commerce` → `messaging` → `carrier` → `settlement`).

### Madurez (resumen)

| Rol | Estado típico |
| --- | --- |
| E-commerce (Shopify) | Live (OAuth, webhooks, sync) |
| Courier (Enviame) | Live path: webhook → shipment; delivered COD → Purchase CAPI |
| Publicidad / Mensajería / Settlement | Mock o parcial; UI marca demo cuando aplica |
| CAPI terminal | Live al delivered COD + cash_collected / conciliación (dedupe `purchase:{orderId}`) |

Detalle técnico de adapters: `docs/INTEGRATION_ADAPTER_GUIDE.md`, `docs/MOCK_INTEGRATIONS.md`.

---

## 4. Módulos del sidebar (tienda)

Ruta base: `/a/[agencySlug]/s/[storeSlug]/…`

Los módulos siguen el mismo ciclo de negocio: ver → operar → atribuir → entregar → cobrar → automatizar → conectar.

### 4.1 Operación y verdad económica

| Módulo | Ruta | Esencia | Funcionalidades importantes |
| --- | --- | --- | --- |
| **Resumen** | `/` (dashboard) | Tablero COD del período | Funnel operativo; ROAS checkout vs entregado; cash / RTO; salud de integraciones; pedidos recientes |
| **Pedidos** | `/orders` | Sistema de registro del pedido COD | Lista por estado; filtros pago/confirmación/geo; detalle cliente e ítems; transiciones de pago (p. ej. cash cobrado) |
| **Atribución** | `/attribution` | Rendimiento ads ↔ outcomes COD | Funnel ads; performance por cuenta/campaña; tendencias de spend; seed demo cuando aplica |
| **Campañas** | `/campaigns` | Drill-down publicitario | Campañas → ad sets → ads; ROAS entregado vs conciliado |
| **Logística** | `/logistics` | Ciclo de vida del envío | Listado de shipments; estados normalizados; frescura de eventos |
| **RTO** | `/rto` | Devoluciones / no entregas | RTO por ciudad, producto, campaña; listado de envíos RTO |
| **Conciliación** | `/reconciliation` | Cierre de cash | Batches de settlement; match pedido↔cobro; discrepancias |

### 4.2 Acción y control

| Módulo | Ruta | Esencia | Funcionalidades importantes |
| --- | --- | --- | --- |
| **Automatizaciones** | `/automations` | Reglas internas ante eventos | Triggers (pedido, shipment, RTO, settlement…); condiciones; acciones (hoy mock) |
| **Alertas** | `/alerts` | Señal operativa | Severidad; ack / resolve / silence; umbrales (p. ej. RTO de campaña) |
| **WhatsApp** | `/whatsapp` | Canal de confirmación | Inbox de conversaciones; templates; vínculo a estado de confirmación del pedido |

### 4.3 Plataforma de la tienda

| Módulo | Ruta | Esencia | Funcionalidades importantes |
| --- | --- | --- | --- |
| **Integraciones** | `/integrations` | Conectar el flujo cerrado | Catálogo por rol; conectar / sync / health; detalle por proveedor |
| **Operaciones** | `/operations` | Salud técnica de la tienda | KPIs de sync; runs; degradaciones; vista operativa de conexiones |
| **Configuración** | `/settings` | Preferencias de la tienda | Nombre/geo; modelo de atribución; umbrales RTO/COD; cambios auditados |

---

## 5. Sidebars de agencia y admin (contexto)

### Agencia (`agencyNavigation`)

| Módulo | Para qué |
| --- | --- |
| Resumen | Vista multi-tienda de la agencia |
| Tiendas | Alta / acceso a stores |
| Equipo | Roles e invitaciones |
| Marca | White-label (nombre, colores) |
| Facturación | Plan / límites (demo hoy) |
| Claves API | Acceso programático |

### Admin de plataforma (`adminNavigation`)

Operación interna: agencias, tiendas, usuarios, integraciones globales, transportistas, jobs, webhooks, dead-letter, auditoría. No forma parte del pitch al merchant; sí del story de fiabilidad B2B.

---

## 6. Cómo contar el producto en una demo (mapa mental)

1. **Resumen** — “Aquí ves el COD real, no el pixel.”
2. **Pedidos** — “Cada orden tiene cliente, ítems y estado de cash.”
3. **Atribución / Campañas** — “El gasto se juzga por entregado y cobrado.”
4. **Logística / RTO** — “El courier cierra si llegó o volvió.”
5. **Conciliación** — “El cash es la conversión.”
6. **Integraciones** — “Shopify = e-commerce, Enviame = courier, Meta = ads…”

Eso es CODTracked en esencia: **cerrar el loop COD y medirlo**.
