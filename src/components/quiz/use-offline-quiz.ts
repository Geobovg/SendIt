"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { quizImageUrls } from "@/lib/quiz/engine";

export type OfflineStatus = "checking" | "saving" | "ready" | "unsupported";

const QUIZ_PAGE = "/quiz";

// Filene siden har lastet (JS, CSS, fonter) pluss alle bildene quizen kan vise.
function quizUrls(): string[] {
  const own = (url: string) => {
    try {
      const parsed = new URL(url, location.href);
      return parsed.origin === location.origin ? parsed.pathname : null;
    } catch {
      return null;
    }
  };
  const loaded = [
    ...performance.getEntriesByType("resource").map((entry) => entry.name),
    ...Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"), (el) => el.src),
    ...Array.from(document.querySelectorAll<HTMLLinkElement>("link[href]"), (el) => el.href),
  ]
    .map(own)
    .filter((path): path is string => !!path && path.startsWith("/_next/static/"));
  return [...new Set([QUIZ_PAGE, ...loaded, ...quizImageUrls()])];
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// Registrerer service workeren og ber den lagre quizen, så siden kan åpnes neste gang uten nett.
// Bare i produksjon: i utvikling skifter JS-filene hele tiden, og en lagret versjon ville bare forvirre.
export function useOfflineQuiz(): { status: OfflineStatus; online: boolean } {
  const [status, setStatus] = useState<OfflineStatus>("checking");
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !("caches" in window)) {
      queueMicrotask(() => setStatus("unsupported"));
      return;
    }
    let cancelled = false;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "quiz-cached" && !cancelled) setStatus("ready");
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    (async () => {
      try {
        if (await caches.match(QUIZ_PAGE)) {
          if (!cancelled) setStatus("ready");
        } else if (!cancelled) setStatus("saving");
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const registration = await navigator.serviceWorker.ready;
        // Uten nett kan ingenting lagres, og det som er lagret fra før brukes som det er.
        if (!navigator.onLine) return;
        // Vent til siden er ferdig lastet, så alle JS-bitene er med i listen.
        if (document.readyState !== "complete") await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
        registration.active?.postMessage({ type: "cache-quiz", urls: quizUrls() });
      } catch {
        if (!cancelled) setStatus("unsupported");
      }
    })();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return { status, online };
}
