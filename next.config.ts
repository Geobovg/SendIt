import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Service workeren for quizen må aldri caches av nettleseren, ellers kommer nye versjoner ikke fram.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
