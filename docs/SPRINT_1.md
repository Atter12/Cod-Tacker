# Sprint 1 — Pedidos

## Entregado
- Listado server-side con searchParams (búsqueda, estados, fechas, ciudad/distrito, monto, sort, paginación).
- Detalle `/orders/[orderId]` con secciones/tabs y timeline unificada.
- Acciones: confirmar, cancelar/rechazar, pago, revisión, nota, alerta — con máquina de transiciones y auditoría.
- Migración `order_notes` + RLS.
- Seed demo v2 con escenarios variados; clear-demo respeta dependencias `demo_seed`.

## Migración
1. `20260711120000_order_notes.sql`

## No incluido
- Pipeline raw_events/jobs, centro de integraciones (Sprint 2), workers (Sprint 3).
