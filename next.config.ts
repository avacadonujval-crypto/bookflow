import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  serverExternalPackages: ["@prisma/client", "bcryptjs", "pdf-parse"],
};

// bodySizeLimit is supported at runtime; typings lag in some Next releases.
(nextConfig as NextConfig & {
  serverActions?: { bodySizeLimit?: string };
}).serverActions = {
  bodySizeLimit: "50mb",
};

export default nextConfig;
