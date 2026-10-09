import type { NextConfig } from "next";

const behindReverseProxy = process.env.AI2DOT_REVERSE_PROXY === "true";

const nextConfig: NextConfig = {
  compress: !behindReverseProxy,
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
  output: "standalone",
  poweredByHeader: false,
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
