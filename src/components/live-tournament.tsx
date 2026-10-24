"use client";

import { useActiveRefresh } from "./use-active-refresh";

/**
 * Keeps paired players in sync without exposing the database directly to browsers.
 * Every refresh renders the whole page on the server, so it polls sparingly, only while the tab is visible and
 * in use, and catches up straight away when the tab comes back into view instead.
 */
export function LiveTournament() {
  useActiveRefresh(15_000);
  return null;
}
