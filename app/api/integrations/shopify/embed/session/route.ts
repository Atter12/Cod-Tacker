import { openEmbeddedShopifyShop } from "@/services/shopify-embed-install.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    return Response.json({ error: "Falta el token de sesión." }, { status: 401 });
  }

  try {
    const home = await openEmbeddedShopifyShop(token);
    return Response.json({ ok: true, ...home });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo abrir la app.";
    const status = /token de sesión|firma|audiencia|expirada|aún no válida|sin tienda|sin usuario|session token exchange/i.test(
      message,
    )
      ? 401
      : 500;
    return Response.json({ error: message }, { status });
  }
}
