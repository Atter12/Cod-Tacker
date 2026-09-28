import type { NextConfig } from "next";
import { FLIPY_DEFAULT_EMBED_ORIGIN } from "../integrations/flipy/embed-urls";

const production = process.env.NODE_ENV === "production";

function readFlipyFrameSrcOrigins(): string {
  const configured = process.env.FLIPY_EMBED_ORIGIN?.trim().replace(/\/$/, "");
  const origins = new Set<string>([FLIPY_DEFAULT_EMBED_ORIGIN]);
  if (configured) origins.add(configured);
  return Array.from(origins).join(" ");
}

// Supabase REST is https://*.supabase.co; Realtime websocket needs wss://*.supabase.co.
const sharedDirectives =
  `default-src 'self'; base-uri 'self'; form-action 'self'; ` +
  `img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; ` +
  `frame-src 'self' ${readFlipyFrameSrcOrigins()};`;

const contentSecurityPolicy =
  `${sharedDirectives} frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; ` +
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co;`;

/** Shopify Admin loads /embed in an iframe. App Bridge comes from cdn.shopify.com. */
const embedContentSecurityPolicy =
  `${sharedDirectives} frame-ancestors https://admin.shopify.com https://*.myshopify.com; ` +
  `script-src 'self' 'unsafe-inline' https://cdn.shopify.com; ` +
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.shopify.com https://*.shopify.com;`;

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: `camera=(), microphone=(), geolocation=(self ${readFlipyFrameSrcOrigins()}), payment=()`,
  },
  ...(production
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

export const securityHeaders: NonNullable<NextConfig["headers"]> = async () => [
  {
    source: "/embed",
    headers: [
      { key: "Content-Security-Policy", value: embedContentSecurityPolicy },
      ...baseHeaders,
    ],
  },
  {
    source: "/embed/:path*",
    headers: [
      { key: "Content-Security-Policy", value: embedContentSecurityPolicy },
      ...baseHeaders,
    ],
  },
  {
    source: "/((?!embed).*)",
    headers: [
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
      { key: "X-Frame-Options", value: "DENY" },
      ...baseHeaders,
    ],
  },
];
