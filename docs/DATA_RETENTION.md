# Retención y privacidad de datos (Sprint 9)

## Principios

- Minimización de PII en artefactos de exportación (conteos + metadatos, no dumps completos).
- Solicitudes de borrado/anominización **nunca** ejecutan wipe inmediato.
- Acciones sensibles quedan en `audit_logs`.

## Retención operativa (política mock / Integration-Ready)

| Dominio | Retención sugerida | Notas |
| --- | --- | --- |
| Pedidos / envíos / conciliación | 24 meses activos | Soft-delete / anonimización bajo solicitud aprobada |
| Conversaciones WhatsApp | 12 meses | Mensajes pueden anonimizar teléfono |
| Audit logs | 36 meses | Inmutables; sin PII completa en `new_data` cuando sea posible |
| API key hashes | Mientras la clave exista + 30 días post-revocación | Nunca se almacena plaintext |
| Export artifacts | 7 días | Resumen en `data_export_requests.artifact_summary` |
| Facturas mock | 24 meses | Sin datos de tarjeta (prohibido) |
| Rate-limit windows | 24 horas | `api_key_rate_limits` |

## Flujos

1. **Exportación**: `data_export_requests` → job `privacy.data_export.mock` → estado `completed` con resumen.
2. **Borrado**: `data_deletion_requests` status `pending_approval` → admin `approved_awaiting_execution` o `rejected`. La ejecución destructiva real queda fuera de Integration-Ready V1 (`executed_mock` solo para demos controladas).

## Roles

- Solicitar export/borrado: owner/admin de agencia (`agency.manage`).
- Aprobar borrado: platform admin (`requirePlatformAdmin`).
