import { ValidationError } from "@/lib/errors";

export const AGENCY_BRANDING_BUCKET = "agency-branding";

export const BRAND_ASSET_KINDS = ["logo", "favicon", "login_background"] as const;
export type BrandAssetKind = (typeof BRAND_ASSET_KINDS)[number];

export const BRAND_ASSET_MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
  ["image/x-icon", "ico"],
  ["image/vnd.microsoft.icon", "ico"],
]);

export function isBrandAssetKind(value: string): value is BrandAssetKind {
  return (BRAND_ASSET_KINDS as readonly string[]).includes(value);
}

export function brandAssetObjectPath(
  agencyId: string,
  kind: BrandAssetKind,
  ext: string,
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${agencyId}/${kind}.${safeExt}`;
}

export function publicUrlForBrandObject(
  supabaseUrl: string,
  objectPath: string,
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const encoded = objectPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  // Cache-bust so sidebar/favicon refresh after replace
  return `${base}/storage/v1/object/public/${AGENCY_BRANDING_BUCKET}/${encoded}?t=${Date.now()}`;
}

export function resolveBrandMimeAndExt(input: {
  contentType?: string | null;
  filename?: string | null;
}): { contentType: string; ext: string } {
  const mime = (input.contentType ?? "").trim().toLowerCase();
  if (mime && ALLOWED_MIME.has(mime)) {
    return { contentType: mime === "image/jpg" ? "image/jpeg" : mime, ext: ALLOWED_MIME.get(mime)! };
  }

  const name = (input.filename ?? "").toLowerCase();
  const fromName = name.split(".").pop() ?? "";
  const byExt: Record<string, { contentType: string; ext: string }> = {
    png: { contentType: "image/png", ext: "png" },
    jpg: { contentType: "image/jpeg", ext: "jpg" },
    jpeg: { contentType: "image/jpeg", ext: "jpg" },
    webp: { contentType: "image/webp", ext: "webp" },
    svg: { contentType: "image/svg+xml", ext: "svg" },
    ico: { contentType: "image/x-icon", ext: "ico" },
  };
  if (fromName && byExt[fromName]) return byExt[fromName]!;

  throw new ValidationError(
    "Formato no permitido. Usa PNG, JPEG, WebP, SVG o ICO.",
  );
}

/** Decode data-URL or raw base64 into bytes. */
export function decodeBrandBase64(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError("Imagen vacía.");
  const payload = trimmed.includes("base64,")
    ? trimmed.slice(trimmed.indexOf("base64,") + "base64,".length)
    : trimmed;
  try {
    const bytes = Buffer.from(payload, "base64");
    if (!bytes.length) throw new Error("empty");
    return bytes;
  } catch {
    throw new ValidationError("No se pudo leer la imagen (base64 inválido).");
  }
}

export function assertBrandAssetSize(byteLength: number) {
  if (byteLength <= 0) throw new ValidationError("Imagen vacía.");
  if (byteLength > BRAND_ASSET_MAX_BYTES) {
    throw new ValidationError("La imagen supera el límite de 8 MB.");
  }
}

export function brandAssetColumn(
  kind: BrandAssetKind,
): "logo_url" | "favicon_url" | "login_background_url" {
  switch (kind) {
    case "logo":
      return "logo_url";
    case "favicon":
      return "favicon_url";
    case "login_background":
      return "login_background_url";
  }
}
