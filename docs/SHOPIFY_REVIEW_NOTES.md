# Notas de revisión · Shopify App Store (borrador)

Texto para pegar en Partner Dashboard → Distribución → **Testing instructions**. Va en inglés porque lo lee el equipo de App Review.

Antes de enviar:

- Completa los campos `[…]`. No subas credenciales reales al repo.
- Graba el screencast con los pasos 1–6. Shopify pide setup y funcionalidad completos (requisito 4.5).
- Confirma que `FLIPY_EMBED_ORIGIN` en producción es un dominio de Flipy y no `*.vercel.app`.
- La tienda de revisión ve todo lo que ve un merchant, incluida la recarga Flipy. No hay flags que oculten funciones a App Review.

---

## Testing instructions (paste below)

**What CODTracked does**
CODTracked syncs a store's cash-on-delivery (COD) orders and tracks them through confirmation, delivery and cash collection. The app requests read-only scopes (`read_orders`, `read_customers`, `read_products`, `read_fulfillments`, `read_locations`). It never creates transactions or marks orders as paid in Shopify.

**Test store and credentials**
- Development store: `[store].myshopify.com`
- CODTracked console login (optional, for step 6): `[email]` / `[password]`
- Flipy test account linked to the store: `[email]` (balance preloaded: `[amount]`)

**Steps**
1. Install the app. It opens embedded at `/embed` in the Shopify admin and links the store automatically. No external sign-up is required.
2. The embedded page shows the store's synced orders and the current plan.
3. **Billing:** "Choose plan" opens Shopify's hosted pricing page (Shopify App Pricing). All CODTracked charges are billed on the merchant's Shopify invoice. There is a Free plan. Paid plans (Starter, Growth, Scale) can be upgraded, downgraded or cancelled from that same Shopify page without contacting support.
4. **Theme app embed (attribution):** Online Store → Themes → Customize → App embeds → enable "CODTracked attribution" → Save.
5. **Flipy logistics (optional):** see the section below.
6. **Web console (optional):** `https://cod.codtracked.com` shows extra reports for the same store. For stores that installed from Shopify, plan changes in the console also redirect to Shopify's pricing page; there is no other checkout.

**About Flipy (third-party courier)**
Flipy is an independent last-mile courier with its own merchants and its own app. Connecting Flipy is optional and free in CODTracked. The merchant has their own Flipy account and wallet, which they use to pay Flipy for deliveries.

- CODTracked shows the merchant's Flipy balance and can create Flipy shipments for COD orders.
- "Top up in Flipy" opens Flipy's own page (`[flipy domain]`) in the top window. Payment is collected by Flipy for Flipy's delivery service. The card form is not inside the embedded app.
- CODTracked does not charge for, and receives no commission or share of, Flipy top-ups or deliveries. These are not app charges.
- `[Optional, keep if you choose to disclose:]` CODTracked and Flipy share the same owner, and they operate as separate products with separate customers.

**Uninstall / reinstall**
Uninstalling cancels the plan through Shopify App Pricing. Reinstalling opens `/embed` again and asks for plan approval through Shopify.
