import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native SQLite driver must stay a runtime `require`, never bundled.
  serverExternalPackages: ["better-sqlite3"],
  typedRoutes: true,
};

export default nextConfig;
