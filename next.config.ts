import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // NEXT_DIST_DIR=.next-build npm run build valida o build sem mexer no cache do next dev.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [{ source: "/mesas/:id/mestre", destination: "/mesas/:id", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
