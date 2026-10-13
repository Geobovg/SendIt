"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

export const SPLASH_SEEN_KEY = "sendit-forside-sett";

const subscribe = () => () => {};
function seenSplash() {
  try { return sessionStorage.getItem(SPLASH_SEEN_KEY) === "1"; } catch { return false; /* uten lagring vises forsiden hver gang */ }
}

/**
 * Forsiden kommer alltid før menyen med modusene. Har man ikke sett den i denne økta (ny fane, appen åpnet
 * på nytt eller nettopp logget inn), sendes man til forsiden. Til da dekker et mørkt lag menyen, så den ikke blinker.
 */
export function SplashGate() {
  const router = useRouter();
  const seen = useSyncExternalStore(subscribe, seenSplash, () => false);
  useEffect(() => {
    if (!seen) router.replace("/");
  }, [seen, router]);
  if (seen) return null;
  return <div className="fixed inset-0 z-[90] bg-[#1c2230]" aria-hidden="true" />;
}
