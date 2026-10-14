"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/client";

// label er nøkkelen i t.career.bottomNav.
const tabs = [
  { href: "/managerkarriere", label: "home", icon: "⌂", match: (path: string) => path === "/managerkarriere" },
  { href: "/managerkarriere/lagtropp", label: "squad", icon: "◈", match: (path: string) => path.startsWith("/managerkarriere/lagtropp") || path.startsWith("/managerkarriere/klubblager") },
  { href: "/managerkarriere/spillermarked", label: "market", icon: "↗", match: (path: string) => path.startsWith("/managerkarriere/spillermarked") },
  { href: "/managerkarriere/pakker", label: "packs", icon: "✦", match: (path: string) => path.startsWith("/managerkarriere/pakker") || path.startsWith("/managerkarriere/informs") || path.startsWith("/managerkarriere/icons") || path.startsWith("/managerkarriere/honorable") },
  { href: "/managerkarriere/sesong", label: "season", icon: "▤", match: (path: string) => ["/managerkarriere/sesong", "/managerkarriere/kamplobby", "/managerkarriere/karrierehistorikk"].some((prefix) => path.startsWith(prefix)) },
] as const;

/** Fast fanelinje nederst, som i FC-appen. Den skjules under kampen, så ingenting stjeler fokus. */
export function ManagerBottomNav() {
  const t = useT();
  const pathname = usePathname();
  if (pathname.startsWith("/managerkarriere/kamp/")) return null;
  return <nav aria-label={t.career.bottomNav.label} className="manager-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#070d16]/95 backdrop-blur-md" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
    <div className="mx-auto grid max-w-xl grid-cols-5">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-black tracking-wide transition ${active ? "text-lime-300" : "text-white/55 hover:text-white"}`}>
          <span className="text-lg leading-none">{tab.icon}</span>{t.career.bottomNav[tab.label]}
        </Link>;
      })}
    </div>
  </nav>;
}
