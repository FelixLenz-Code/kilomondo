import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Baseline security headers for every response. Kept minimal so it can't
  // break the app: frame-ancestors/X-Frame-Options stop clickjacking, nosniff
  // stops MIME guessing, and Referrer-Policy limits referer leakage. (A full
  // script CSP would need per-request nonces and is intentionally out of scope.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // puppeteer (server-side 3D animation rendering) must stay external — it
  // resolves its own Chromium and must not be bundled by Next.
  // three must also stay external: render-animation.ts does
  // `require.resolve("three")` to locate the package on disk and copy its
  // build + examples/jsm into a temp dir served to headless Chrome. If bundled,
  // webpack rewrites require.resolve to a numeric module id and path.dirname()
  // throws ("path must be a string, received number").
  serverExternalPackages: ["puppeteer", "puppeteer-core", "three"],
  experimental: {
    serverActions: {
      // Headroom for GLB model uploads (~17MB) and vehicle import ZIPs, which
      // can bundle the 3D video plus many photos.
      bodySizeLimit: "100mb",
    },
    // Middleware buffers the request body and caps it independently of
    // serverActions.bodySizeLimit (default 10MB) — keep them in sync.
    middlewareClientMaxBodySize: "100mb",
  },
  webpack: (config) => {
    // tesseract.js is loaded only in the browser (OCR for odometer/fuel capture).
    // Stop webpack from following its Node worker path into the client bundle,
    // which would require Node-only modules (node-fetch, is-url) we don't ship.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "node-fetch": false,
      "is-url": false,
    };
    return config;
  },
};

export default withSerwist(nextConfig);
