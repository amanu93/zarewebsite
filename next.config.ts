import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  trailingSlash: false,

  // Emits a self-contained server bundle so the runtime Docker image does not
  // need node_modules. See Dockerfile.
  output: "standalone",

  images: {
    // WebP only, deliberately no AVIF. The optimizer encodes on demand and
    // its cache does not survive a redeploy, so first viewers pay the encode
    // cost — and a cold AVIF encode measures ~3x a WebP one (0.74s vs 0.23s
    // per variant on a dev machine; several seconds each on the production
    // box, which is what made the /about photo band sit empty). Every photo
    // source is already WebP; AVIF's ~20% size win is not worth the stall.
    formats: ["image/webp"],
    // Trimmed from the defaults to the widths this layout actually requests,
    // so the optimizer generates fewer variants per source image.
    deviceSizes: [640, 828, 1080, 1200, 1920],
    // 75 for photographs; 100 for product screenshots, whose small UI text
    // smears at any lossy setting below it. Next 16 rejects any quality not
    // listed here.
    qualities: [75, 100],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  experimental: {
    // Rewrites barrel imports to deep paths so a single icon does not pull in
    // the whole package. Mantine is listed for the admin bundle; it will drop
    // off this list once the marketing side stops importing it.
    optimizePackageImports: [
      "@tabler/icons-react",
      "lucide-react",
      "@mantine/core",
      "@mantine/hooks",
    ],
  },

  async headers() {
    return [
      // The staff portal stays out of search indexes even if a link to it
      // leaks. Belt and braces with its robots metadata and robots.ts.
      // `:path*` matches zero segments too, so /portal itself is covered.
      {
        source: '/portal/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },

  async redirects() {
    return [
      // /our-work was the live, indexed portfolio route. /work replaced it at
      // the M7.2 cutover, so this preserves the inbound links and passes the
      // ranking signal on. 308 rather than 302: the move is permanent.
      { source: '/our-work', destination: '/work', permanent: true },
      {
        source: '/our-work/:path*',
        destination: '/work/:path*',
        permanent: true,
      },
    ];
  },
};

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(
  nextConfig,
);
