"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type OrdersRealtimeStatus = "connecting" | "live" | "idle" | "error";

/**
 * Subscribes to orders postgres_changes for a store (or one order) and
 * refreshes the current RSC tree. Debounced to coalesce burst updates.
 * Also refreshes when the tab becomes visible again.
 */
export function useStoreOrdersRealtime(
  storeId: string,
  options?: { orderId?: string; debounceMs?: number },
): OrdersRealtimeStatus {
  const router = useRouter();
  const [status, setStatus] = useState<OrdersRealtimeStatus>("connecting");
  const debounceMs = options?.debounceMs ?? 400;
  const orderId = options?.orderId?.trim() || undefined;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!storeId.trim()) {
      setStatus("idle");
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!cancelled) routerRef.current.refresh();
      }, debounceMs);
    };

    const filter = orderId ? `id=eq.${orderId}` : `store_id=eq.${storeId}`;
    const channelName = orderId ? `orders:${storeId}:${orderId}` : `orders:${storeId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter,
        },
        () => {
          scheduleRefresh();
        },
      )
      .subscribe((next) => {
        if (cancelled) return;
        if (next === "SUBSCRIBED") setStatus("live");
        else if (next === "CHANNEL_ERROR" || next === "TIMED_OUT") setStatus("error");
        else if (next === "CLOSED") setStatus("idle");
        else setStatus("connecting");
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [storeId, orderId, debounceMs]);

  return status;
}
