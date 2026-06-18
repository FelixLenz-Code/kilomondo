import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
      // Allow image uploads (base64) and GLB model uploads (up to ~25MB) in the
      // action payload.
      bodySizeLimit: "30mb",
    },
    // Middleware buffers the request body and caps it independently of
    // serverActions.bodySizeLimit (default 10MB). GLB models are ~17MB, so the
    // body got truncated → "Unexpected end of form". Match the action limit.
    middlewareClientMaxBodySize: "30mb",
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
