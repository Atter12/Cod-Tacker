"use client";

import { useEffect } from "react";

/**
 * Forces the agency favicon in the browser tab.
 * Next.js `app/favicon.ico` otherwise wins over nested `generateMetadata` icons.
 */
export function BrandFavicon({ href }: { href?: string | null }) {
  useEffect(() => {
    if (!href) return;

    const apply = (rel: string) => {
      let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
      }
      link.href = href;
    };

    apply("icon");
    apply("shortcut icon");
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => {
      link.href = href;
    });
  }, [href]);

  return null;
}
