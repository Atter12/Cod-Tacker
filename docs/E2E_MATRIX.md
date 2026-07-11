# E2E matrix — Integration-Ready V1

Reproducible 16-step flow (mock). Printable checklist + probes:

```bash
npm run e2e:matrix
```

| # | Step | How |
| --- | --- | --- |
| 1 | Registrar usuario | `/register` |
| 2 | Onboarding agencia/tienda | `/onboarding` (trial Starter) |
| 3 | Segunda tienda | Agencia → Tiendas |
| 4 | Invitar y aceptar | Equipo → `/invites/accept` |
| 5 | Shopify demo | Integraciones → conectar mock |
| 6 | Pedidos | `seed:demo` o sync + `jobs:process` |
| 7 | Meta/TikTok mock | Sync / seed ads |
| 8 | Shipment + carrier | Logística → mock event → jobs |
| 9 | WhatsApp confirm/reject | Conversación → simular → jobs |
| 10 | Entregar/retornar | Carrier mock terminal |
| 11 | Import CSV | Conciliación → import |
| 12 | Conciliar | Match / aprobar |
| 13 | Automatización | Crear regla → disparar |
| 14 | Job fallido | Admin jobs / dead-letter → retry |
| 15 | ROAS/RTO/margen | Atribución + RTO + dashboard |
| 16 | Auditoría | Admin → Auditoría |

No editar la BD manualmente: todo vía UI + jobs.

See also [POST_DEPLOY_CHECKLIST.md](./POST_DEPLOY_CHECKLIST.md) and [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md).
