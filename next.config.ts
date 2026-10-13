import type { NextConfig } from "next";

// Filene i public får ellers «max-age=0», så nettleseren spør Vercel på nytt hver gang et bilde vises.
// Bildene byttes sjelden, så de kan caches et døgn (og brukes mens de hentes på nytt i en uke).
const STATIC_ASSET_CACHE = "public, max-age=86400, stale-while-revalidate=604800";
const STATIC_ASSET_FOLDERS = ["players", "crests", "flags", "personal", "audio"];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Service workeren for quizen må aldri caches av nettleseren, ellers kommer nye versjoner ikke fram.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
      ...STATIC_ASSET_FOLDERS.map((folder) => ({ source: `/${folder}/:path*`, headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE }] })),
    ];
  },
  images: {
    // Gratisplanen hos Vercel har bare 5 000 bildeoptimaliseringer i måneden, og den var nesten brukt opp.
    // Spillerbildene er allerede små, og profilbildene skaleres ned før de lastes opp.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
