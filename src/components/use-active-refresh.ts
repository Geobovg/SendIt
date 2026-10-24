"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const IDLE_MS = 10 * 60_000;

/**
 * Oppdaterer siden med jevne mellomrom, men bare mens fanen er synlig og brukeren har rørt skjermen de siste ti minuttene.
 * Hver oppdatering lager hele siden på serveren på nytt og leser databasen, så en fane som blir stående åpen ville
 * ellers kostet tusenvis av kall i døgnet (se docs/vercel-forbruk.md). Kommer brukeren tilbake, oppdateres siden med en gang.
 */
export function useActiveRefresh(ms: number, active = true) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let lastActivity = Date.now();
    let last = 0;
    const refresh = () => {
      const now = Date.now();
      // focus og visibilitychange kommer begge når fanen åpnes igjen; én oppdatering holder.
      if (document.visibilityState !== "visible" || now - lastActivity > IDLE_MS || now - last < 2_000) return;
      last = now;
      router.refresh();
    };
    const wake = () => { lastActivity = Date.now(); refresh(); };
    const touch = () => {
      const wasIdle = Date.now() - lastActivity > IDLE_MS;
      lastActivity = Date.now();
      if (wasIdle) refresh();
    };
    const timer = window.setInterval(refresh, ms);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    for (const type of ["pointerdown", "keydown", "scroll", "touchstart"]) window.addEventListener(type, touch, { passive: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
      for (const type of ["pointerdown", "keydown", "scroll", "touchstart"]) window.removeEventListener(type, touch);
    };
  }, [active, ms, router]);
}
