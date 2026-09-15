/**
 * Merchant-facing onboarding for storefront UTM attribution.
 * Primary path: Theme App Extension (App Embed). ScriptTag is a secondary fallback.
 */

export function ShopifyAttributionOnboarding({
  connected = false,
}: {
  connected?: boolean;
}) {
  return (
    <div className="space-y-4 border-t border-border pt-3">
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-text-primary">
          Atribución UTM en la tienda online
        </h3>
        <p className="text-[12.5px] leading-relaxed text-text-secondary">
          Para que CODTracked atribuya campañas (UTM y click IDs) a pedidos COD, activa la{" "}
          <span className="font-medium text-text-primary">extensión de tema</span> en tu tienda.
          Queda desactivada por defecto tras instalar la app.
        </p>
      </div>

      <div className="space-y-2 rounded-md border border-border bg-surface px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-primary">
          Paso recomendado · App Embed
        </p>
        <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-text-secondary">
          <li>
            En el admin de Shopify:{" "}
            <span className="font-medium text-text-primary">
              Tienda online → Temas → Personalizar
            </span>
            .
          </li>
          <li>
            Abre{" "}
            <span className="font-medium text-text-primary">
              Configuración del tema → Incrustaciones de apps
            </span>{" "}
            (App embeds).
          </li>
          <li>
            Activa{" "}
            <span className="font-medium text-text-primary">Captura de atribución</span> (CODTracked
            / <code className="text-text-primary">codtracked-attribution</code>).
          </li>
          <li>
            <span className="font-medium text-text-primary">Guarda</span> el tema.
          </li>
          <li>
            Prueba: abre un producto con UTMs en la URL → en{" "}
            <code className="text-text-primary">/cart.js</code> deben aparecer attributes de
            atribución → completa una compra de prueba.
          </li>
        </ol>
      </div>

      {connected ? (
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium text-text-primary">Respaldo automático (ScriptTag)</p>
          <p className="text-[12.5px] leading-relaxed text-text-secondary">
            Al conectar o reautorizar, CODTracked también puede registrar un ScriptTag que carga el
            mismo script de atribución. El{" "}
            <span className="font-medium text-text-primary">App Embed</span> es el camino preferido
            para App Store y temas modernos; si ya pegaste un snippet en{" "}
            <code className="text-text-primary">theme.liquid</code>, puedes quitarlo para evitar
            duplicados.
          </p>
        </div>
      ) : (
        <p className="text-[12.5px] leading-relaxed text-text-secondary">
          Después de conectar la tienda, completa el App Embed. Sin ese paso, la sync de pedidos
          funciona; la atribución UTM en vitrina puede quedar incompleta.
        </p>
      )}
    </div>
  );
}
