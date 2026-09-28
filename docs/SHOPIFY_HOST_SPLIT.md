# Cerrar el corte Shopify / producto

**Estado:** el corte ya está en código. El portero vive en `proxy.ts` (Next 16; `middleware.ts` está deprecado) y no redirige hasta que `SHOPIFY_APP_URL` y `PRODUCT_APP_URL` tengan hosts distintos. Falta el deploy: env, DNS de `cod.codtracked.com`, y mover webhooks que no son de Shopify fuera de `app`.

**Corte de producto**

| Host | Rol | Incluye | No incluye |
| --- | --- | --- | --- |
| `https://app.codtracked.com` | App de Shopify | `/embed`, OAuth, webhooks de Shopify, script de atribución | Consola, login de agencia, Facturación, ROAS, campañas |
| `https://cod.codtracked.com` | Producto de pago | Consola, métricas de valor, ROAS, RTO, conciliación, Flipy, Facturación | El iframe que carga el Admin |

Un solo proyecto Next y la misma Postgres. El conector escribe pedidos. El producto los lee para los extras. La tienda instalada desde Shopify se usa sin pagar. El cobro es por servicios de más, no por conectar ni por ver esos pedidos.

Shopify sigue con `application_url = https://app.codtracked.com/embed` y `embedded = true` en [`shopify.app.toml`](../shopify.app.toml).

---

## Ya está en código

- `/embed` + App Bridge en el `<head>` (`app/layout.tsx`, `app/embed/page.tsx`, `components/shopify/ShopifyEmbeddedApp.tsx`).
- Session token → token offline → tienda + sync (`services/shopify-embed-install.service.ts`, `POST /api/integrations/shopify/embed/session`).
- La agencia nueva se marca `settings.shopify_connector = "free"`.
- Crear otra tienda, sin plan, usa el mensaje de extra de consola (`lib/billing/connector-access.ts`, `assertCanCreateStore` en `lib/billing/limits.ts`).
- El embed no enlaza a Facturación.
- `PRODUCT_APP_URL` en `config/env.ts` (`getProductAppUrl`). Stripe (`app/actions/billing.ts`), auth (`app/actions/auth.ts`) e invitaciones (`app/actions/invitations.ts`) usan esa URL. El callback de Shopify suma ese origen a la allowlist (`app/api/integrations/shopify/callback/route.ts`); el `redirect_uri` no cambia.
- Portero en `proxy.ts` → `lib/hosts/host-gate.ts`. Mismo host (local, o antes de partir las URLs): no redirige.

---

## 1. Dos URLs

`NEXT_PUBLIC_APP_URL` sigue siendo el fallback. Las URLs de producto y de la app Shopify son:

| Variable | Valor | Uso |
| --- | --- | --- |
| `SHOPIFY_APP_URL` | `https://app.codtracked.com` | OAuth, webhooks, script público. Ya la lee `lib/integrations/shopify/env.ts`. |
| `PRODUCT_APP_URL` | `https://cod.codtracked.com` | Retorno de Stripe, correos, invitaciones, login del producto. |

El callback registrado en Shopify se queda en `app`:

`https://app.codtracked.com/api/integrations/shopify/callback`

Si la consola en `cod` inicia “Conectar Shopify”, el retorno del browser vuelve a `cod` porque el origen del request entra en la allowlist junto con `PRODUCT_APP_URL`. El `redirect_uri` no cambia.

En local ambas URLs pueden ser `http://localhost:3000`.

---

## 2. Portero de host

`proxy.ts` llama a `decideHostGate` antes de refrescar la sesión. No hay `middleware.ts`: en Next 16 ese archivo está deprecado y este proyecto ya usaba `proxy.ts`.

**Host `app` (y `SHOPIFY_APP_URL`)** deja pasar:

- `/embed`
- `/api/integrations/shopify/*` (OAuth, session del embed y webhooks, incluido GDPR)
- el script `/shopify/codtracked-attribution.js`
- assets de Next (`/_next`, favicon)

Cualquier otra ruta (`/`, `/login`, `/a/...`, `/billing`) redirige al mismo path en `PRODUCT_APP_URL`. Así `/billing` en el dominio de la app no muestra Stripe.

**Host `cod`** deja pasar la consola. `/embed` redirige a `SHOPIFY_APP_URL/embed` para que el Admin no cargue Facturación dentro del iframe.

En local, sin esos hosts, el portero no redirige. Un host que no es ni `app` ni `cod` (el deployment `*.vercel.app` de los crons) tampoco redirige.

El embed no gana un enlace “continúa en cod…”. Quien solo usa la app se queda en el Admin.

---

## 3. Qué permanece en cada superficie

**App (`app.codtracked.com`)** — no añadir pantallas de métricas ni de pago:

- `app/embed/**`
- `components/shopify/ShopifyEmbeddedApp.tsx`
- `app/api/integrations/shopify/**`
- `services/shopify-embed-install.service.ts`
- `lib/integrations/shopify/embed-home.ts`
- webhooks y `public/shopify/codtracked-attribution.js`

**Producto (`cod.codtracked.com`)** — mismas rutas, otro host:

- Consola `/a/[agencySlug]/s/[storeSlug]/**` y nav en `config/navigation.ts` (atribución, campañas, RTO, conciliación, logística, Flipy, automatizaciones).
- Agencia, incluida `app/a/[agencySlug]/(agency)/billing/page.tsx` y `components/billing/BillingPanel.tsx`.
- `routes.agency.billing` solo se construye en respuestas del host de producto.

---

## 4. Datos

No se parte la base. No hace falta otra tabla para este corte.

- Conector: `shopify_shop_domain`, `integrations` (`origin: shopify_admin_embed`), pedidos.
- Producto: lee esos pedidos para ROAS y métricas. No bloquea el sync del conector con `assertCanImportCsvRows` ni con el plan (eso hoy solo aplica a CSV / importaciones, no al job de Shopify).
- Extra de otra tienda: ya está en `additionalStoreLimitMessage`.

---

## 5. Ops, después del código

1. Env en Vercel: `SHOPIFY_APP_URL=https://app.codtracked.com` y `PRODUCT_APP_URL=https://cod.codtracked.com`. Hasta que los hosts difieran, el portero no cambia rutas.
2. DNS: `cod.codtracked.com` al mismo proyecto. `app.codtracked.com` no cambia la URL que Shopify ya tiene.
3. Repuntar a `cod` los webhooks que hoy pegan a `app` y no son de Shopify (Stripe, Flipy, Envia, Enviame, WhatsApp). El portero responde 307 y esos emisores no deben depender del redirect.
4. Supabase Auth: Site URL y redirects del correo en `https://cod.codtracked.com`.
5. No hace falta otro `shopify app deploy` si `application_url` sigue en `https://app.codtracked.com/embed`.
6. Reenvío a revisión solo después del 4 de octubre de 2026, con el portero ya en producción.

---

## Cómo se sabe que quedó cerrado

- Instalar o abrir la app en el Admin carga `/embed`, muestra la tienda conectada y pedidos, sin Stripe y sin link al otro host.
- `https://app.codtracked.com/a/.../billing` redirige a `https://cod.codtracked.com/...` y no renderiza Facturación en el host de la app.
- Checkout de Stripe y el correo de invitación abren `cod.codtracked.com`.
- Conectar Shopify desde la consola vuelve a `cod`, con el callback siguiendo en `app`.
- Una agencia `shopify_connector: free` ve pedidos en el Admin. Crear una segunda tienda en la consola pide el extra de plan.
- `npx tsx --test lib/billing/connector-access.test.ts lib/integrations/shopify/session-token.test.ts lib/hosts/host-gate.test.ts` en verde: la app deja `/embed` y manda `/billing` al producto.
