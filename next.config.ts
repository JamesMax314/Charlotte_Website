import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    // Workers has no /_next/image optimizer. See src/image-loader.ts.
    loader: "custom",
    loaderFile: "./src/image-loader.ts",
    /*
      These must stay identical to WIDTH_LADDER in src/image-loader.ts.

      Next builds the srcset from these widths, and the loader then rounds each
      one up to the nearest rung that actually exists in R2. With Next's
      defaults the two disagree, so every width was rounded twice: a phone
      needing 774px picked Next's 828, which the loader rounded to 1600 — twice
      the image, and four times the memory to decode it, for nothing. Offering
      the real rungs makes the browser's choice the final one.
    */
    deviceSizes: [400, 800, 1600, 2400],
  },
};

// Makes Cloudflare bindings (D1, R2) available to `next dev`, so local
// development hits the same APIs as production. No-op outside `next dev`.
void initOpenNextCloudflareForDev();

export default nextConfig;
