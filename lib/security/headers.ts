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
const contentSecurityPolicy =
  `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; ` +
  `img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ` +
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self' data:; ` +
  `frame-src 'self' ${readFlipyFrameSrcOrigins()};`;

export const securityHeaders: NonNullable<NextConfig["headers"]> = async () => [{
  source: "/(.*)",
  headers: [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: `camera=(), microphone=(), geolocation=(self ${readFlipyFrameSrcOrigins()}), payment=()`,
    },
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  ],
}];
