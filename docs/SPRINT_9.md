# Sprint 9 — Configuración, white-label, API keys, billing mock y admin

Completed scope:

- Store settings operativo (`/settings`): nombre, país/moneda/TZ, atribución, RTO, COD, alertas, demo — schema versionado `schema_version=1` en `stores.settings`.
- White-label (`/branding`): product_name, URLs logo/favicon/login, colores, soporte, hide branding gated por plan, preview responsive, restaurar defaults.
- API keys (`/api-keys`): create/rotate/revoke con crypto SHA-256; plaintext una sola vez; scopes; expiración; rate limit persistente `api_key_rate_limits`; helper `validateApiKeyRequest` (nunca expone `key_hash`).
- Billing mock (`/billing`): plan/trial/uso/límites, upgrade/downgrade simulado, cancel_at_period_end + grace, facturas `invoice_records`, badge “Facturación de demostración”.
- Límites reales: `createStore` → `store_limit`; CSV import → `order_limit` / feature `csv_import`.
- Admin: detalle agencia/tienda/usuario; suspender/reactivar; acceso soporte auditado sin impersonación.
- Privacidad: export vía job `privacy.data_export.mock`; deletion request con aprobación (sin wipe inmediato).
- Migración: `20260711200000_sprint9_settings_billing_privacy.sql`
- Onboarding crea trial Starter + white_label_settings defaults.
- Docs: `docs/DATA_RETENTION.md`

**Not in Sprint 9:** pasarela de pago real, Storage upload de logos, impersonación de usuarios, borrado destructivo automático.

## Smoke

1. Aplicar migración `…200000…`.
2. Settings → editar umbrales RTO → guardar → verificar auditoría.
3. Branding → colores + preview → Growth plan para hide branding.
4. API keys → crear (confirmar) → copiar plaintext → rotar/revocar.
5. Billing → cambiar plan → crear 3ª tienda en Starter debe fallar amigable.
6. Admin → detalle agencia → suspender → acceso tenant bloqueado (`is_active`).
7. Privacidad → export → `npm run jobs:process`.

## Routes

| UI | Path |
| --- | --- |
| Store settings | `/settings` |
| Branding | `/branding` |
| API keys | `/api-keys` |
| Billing | `/billing` |
| Admin agency | `/admin/agencies/[agencyId]` |
| Admin store | `/admin/stores/[storeId]` |
| Admin user | `/admin/users/[userId]` |
