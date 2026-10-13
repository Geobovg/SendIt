"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps paired players in sync without exposing the database directly to browsers.
 * Every refresh renders the whole page on the server, so it polls sparingly and catches up
 * straight away when the tab comes back into view instead.
 */
export function LiveTournament() {
  const router = useRouter();
  useEffect(() => {
    let last = 0;
    const refresh = () => {
      // focus and visibilitychange both fire when the tab is reopened; one refresh is enough.
      if (document.visibilityState !== "visible" || Date.now() - last < 2_000) return;
      last = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
