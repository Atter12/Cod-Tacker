"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type OrdersRealtimeStatus = "connecting" | "live" | "polling" | "idle" | "error";

const FALLBACK_POLL_MS = 30_000;

async function resolveAccessToken(
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  const first = await supabase.auth.getSession();
  if (first.data.session?.access_token) return first.data.session.access_token;

  // Cookie session can lag one tick after hydration.
  await new Promise((r) => setTimeout(r, 150));
  const second = await supabase.auth.getSession();
  if (second.data.session?.access_token) return second.data.session.access_token;

  // getUser refreshes from Auth API when local session is cold.
  const user = await supabase.auth.getUser();
  if (user.error || !user.data.user) return null;
  const third = await supabase.auth.getSession();
  return third.data.session?.access_token ?? null;
}

/**
 * Prefer Supabase Realtime postgres_changes; if the socket fails, fall back to
 * a visible-tab refresh every 30s so ops still see new sync/worker writes.
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!storeId.trim()) {
      setStatus("idle");
      return;
    }

    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const clearPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const scheduleRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!cancelled) routerRef.current.refresh();
      }, debounceMs);
    };

    const startFallbackPolling = () => {
      if (cancelled || pollRef.current) return;
      setStatus("polling");
      pollRef.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          routerRef.current.refresh();
        }
      }, FALLBACK_POLL_MS);
    };

    const filter = orderId ? `id=eq.${orderId}` : `store_id=eq.${storeId}`;
    const channelName = orderId ? `orders:${storeId}:${orderId}` : `orders:${storeId}`;

    const bindChannel = async () => {
      try {
        const token = await resolveAccessToken(supabase);
        if (cancelled) return;

        if (token) {
          supabase.realtime.setAuth(token);
        } else {
          console.warn("orders.realtime.no_session");
          startFallbackPolling();
          return;
        }

        if (channel) {
          await supabase.removeChannel(channel);
          channel = null;
        }

        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "orders", filter },
            () => scheduleRefresh(),
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "orders", filter },
            () => scheduleRefresh(),
          )
          .subscribe((next, err) => {
            if (cancelled) return;
            if (next === "SUBSCRIBED") {
              clearPoll();
              setStatus("live");
              return;
            }
            if (next === "CHANNEL_ERROR" || next === "TIMED_OUT") {
              console.error("orders.realtime.subscribe_failed", {
                next,
                err: err?.message ?? err,
                filter,
              });
              startFallbackPolling();
              return;
            }
            if (next === "CLOSED") {
              if (!pollRef.current) setStatus("idle");
              return;
            }
            setStatus("connecting");
          });
      } catch (err) {
        console.error("orders.realtime.bind_failed", err);
        if (!cancelled) startFallbackPolling();
      }
    };

    void bindChannel();

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      }
      if (event === "SIGNED_OUT") {
        clearPoll();
        setStatus("error");
      }
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      clearPoll();
      document.removeEventListener("visibilitychange", onVisibility);
      authSub.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [storeId, orderId, debounceMs]);

  return status;
}
