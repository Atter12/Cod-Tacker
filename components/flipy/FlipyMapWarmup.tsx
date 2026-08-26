"use client";

import { withFlipyLocationClientParams } from "@/lib/integrations/flipy/embed-urls";
import type { FlipyMapEmbedPrefetch } from "@/components/flipy/FlipyRouteAddressModal";

function readClientParentOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

type WarmupTarget = {
  id: "pickup" | "delivery";
  prefetch: FlipyMapEmbedPrefetch;
};

type Props = {
  targets: WarmupTarget[];
};

/** Off-screen iframes to warm Flipy map + Google Maps cache before the route modal opens. */
export function FlipyMapWarmup({ targets }: Props) {
  if (targets.length === 0) return null;

  const parentOrigin = readClientParentOrigin();

  return (
    <div
      className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0"
      aria-hidden
    >
      {targets.map(({ id, prefetch }) => (
        <iframe
          key={`${id}-${prefetch.prefillKey}`}
          title=""
          tabIndex={-1}
          src={withFlipyLocationClientParams(prefetch.embedUrl, parentOrigin, {
            liveSync: true,
          })}
          className="h-[480px] w-[640px] border-0"
          allow="geolocation"
        />
      ))}
    </div>
  );
}
