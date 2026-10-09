"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import {
  isFlipyWalletReturnPending,
  stripFlipyWalletReturnParam,
} from "@/lib/integrations/flipy/embed-urls";

/** After Flipy redirects back, drop the marker and refresh the logistics balance. */
export function FlipyWalletReturnNotice() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isFlipyWalletReturnPending(window.location.search)) return;
    const next = stripFlipyWalletReturnParam(window.location.href);
    window.history.replaceState(null, "", next);
    setVisible(true);
    router.refresh();
  }, [router]);

  if (!visible) return null;

  return (
    <Alert variant="info" title="Recarga Flipy">
      Volviste desde la recarga de logística. El saldo de operaciones se está actualizando.
    </Alert>
  );
}
