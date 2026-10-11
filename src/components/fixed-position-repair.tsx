"use client";

import { useEffect } from "react";

// iOS (særlig som hjemskjerm-app) glemmer av og til å flytte faste elementer tilbake når tastaturet
// lukkes eller appen hentes fram igjen, så fanelinjen og musikkknappen blir hengende midt på skjermen.
// En rulling på én piksel fram og tilbake tvinger Safari til å regne ut posisjonene på nytt.
function repairFixedPositions() {
  const { scrollX, scrollY } = window;
  window.scrollTo(scrollX, scrollY + 1);
  window.scrollTo(scrollX, scrollY);
}

// Bare felt man skriver i åpner tastaturet; knapper, avkrysningsbokser og nedtrekkslister gjør det ikke.
function isTyping() {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image", "hidden"].includes(el.type);
}

/** Retter opp faste elementer som iOS lar ligge igjen der tastaturet var. Viser ingenting selv. */
export function FixedPositionRepair() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let lastHeight = viewport?.height ?? window.innerHeight;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Tastaturanimasjonen må bli ferdig før posisjonene kan rettes.
    const repairSoon = () => { clearTimeout(timer); timer = setTimeout(repairFixedPositions, 120); };
    // Tastaturet er åpent mens et skrivefelt har fokus og den synlige delen er mye lavere enn vinduet;
    // da skjules fanelinjen. Høyden ganges med zoomen, så knipezoom ikke tolkes som et åpent tastatur,
    // og uten fokus i et skrivefelt kan ikke tastaturet være oppe, selv om iOS glemmer å melde at det lukket seg.
    const updateKeyboard = () => {
      const height = viewport ? viewport.height * viewport.scale : window.innerHeight;
      document.documentElement.toggleAttribute("data-keyboard-open", isTyping() && height < window.innerHeight * 0.8);
      if (height > lastHeight) repairSoon();
      lastHeight = height;
    };
    const onFocusOut = () => { setTimeout(updateKeyboard, 0); repairSoon(); };
    const onVisible = () => { if (document.visibilityState === "visible") { updateKeyboard(); repairSoon(); } };
    const onShow = () => { updateKeyboard(); repairSoon(); };
    viewport?.addEventListener("resize", updateKeyboard);
    window.addEventListener("focusin", updateKeyboard);
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("orientationchange", repairSoon);
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      viewport?.removeEventListener("resize", updateKeyboard);
      window.removeEventListener("focusin", updateKeyboard);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("orientationchange", repairSoon);
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
      document.documentElement.removeAttribute("data-keyboard-open");
    };
  }, []);
  return null;
}
