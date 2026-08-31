"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the dashboard on a timer so "now", weather, tasks, agenda and
 * mail stay current without a manual reload. Only fires while the tab is
 * visible, and also refreshes when you switch back to the tab (throttled).
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const lastRef = useRef(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      lastRef.current = Date.now();
      router.refresh();
    };

    const id = setInterval(refresh, intervalMs);

    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRef.current > 30_000
      ) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
