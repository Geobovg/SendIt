"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SPLASH_SEEN_KEY } from "./splash-gate";

/** Knappen på forsiden. Den husker at forsiden er sett, så menyen slipper brukeren inn. */
export function SplashEnter({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        try { sessionStorage.setItem(SPLASH_SEEN_KEY, "1"); } catch { /* privat modus: da vises forsiden igjen neste gang */ }
      }}
    >
      {children}
    </Link>
  );
}
