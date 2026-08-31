import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    // Workers has no /_next/image optimizer. See src/image-loader.ts.
    loader: "custom",
    loaderFile: "./src/image-loader.ts",
  },
};

// Makes Cloudflare bindings (D1, R2) available to `next dev`, so local
// development hits the same APIs as production. No-op outside `next dev`.
void initOpenNextCloudflareForDev();

export default nextConfig;
