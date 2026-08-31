import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    // Artwork is served from R2 via the Cloudflare Images binding. Formats are
    // ordered cheapest-first: AVIF typically halves the bytes of WebP.
    formats: ["image/avif", "image/webp"],
  },
};

// Makes Cloudflare bindings (R2, D1) available to `next dev`, so local
// development hits the same APIs as production. No-op outside `next dev`.
void initOpenNextCloudflareForDev();

export default nextConfig;
