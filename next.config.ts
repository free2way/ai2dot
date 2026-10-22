import type { NextConfig } from "next";

const behindReverseProxy = process.env.AI2DOT_REVERSE_PROXY === "true";

const nextConfig: NextConfig = {
  compress: !behindReverseProxy,
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
  output: "standalone",
  poweredByHeader: false,
  // PGlite ships WASM and extension tarballs that must stay on disk at
  // runtime. Keep it external for the standalone desktop server and make
  // sure the file tracer copies every runtime asset.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@electric-sql/pglite-pgvector",
  ],
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/@electric-sql/pglite/dist/**/*",
      "node_modules/@electric-sql/pglite-pgvector/dist/**/*",
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "ai.ai2dot.com" }],
        destination: "/workspace",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Accel-Buffering", value: "no" }],
      },
    ];
  },
};

export default nextConfig;
