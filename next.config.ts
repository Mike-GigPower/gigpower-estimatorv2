import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "request.gigpower.com",
          },
        ],
        destination: "/request-estimate",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;