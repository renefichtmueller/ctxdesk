import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["chokidar", "@prisma/client", "better-sqlite3"],
};

export default nextConfig;
