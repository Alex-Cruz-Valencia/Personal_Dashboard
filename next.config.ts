import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OAuth callbacks contain short-lived verification parameters; don't log their URLs.
  logging: { incomingRequests: { ignore: [/\/api\/auth\/fatsecret\/callback/] } },
};

export default nextConfig;
