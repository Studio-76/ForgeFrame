/// <reference types="vitest" />
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { analyzer, type AnalyzerPluginOptions } from "vite-bundle-analyzer";

/**
 * Opt-in bundle analyzer — set VISUALIZE=1 to generate a treemap report.
 * Outputs to dist/stats.html showing the composition of every output chunk.
 */
function bundleAnalyzerPlugin(): PluginOption {
  if (process.env.VISUALIZE !== "1") {
    return { name: "bundle-analyzer" };
  }

  const analyzerOptions: AnalyzerPluginOptions = {
    enabled: true,
    analyzerMode: "static",
    fileName: "stats.html",
    defaultSizes: "gzip",
    reportTitle: "ForgeFrame Frontend Bundle Analysis",
    openAnalyzer: false,
    summary: true,
  };

  return analyzer(analyzerOptions) as PluginOption;
}

export default defineConfig({
  plugins: [tailwindcss(), react(), bundleAnalyzerPlugin()],
  server: {
    proxy: {
      "/admin": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    minify: "esbuild",
    cssMinify: "lightningcss",
    sourcemap: false,
    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting strategy:
         *
         * - `vendor-react` (193 kB): React + React-DOM — the two heaviest deps,
         *   stable across versions, excellent HTTP cache residency.
         * - `vendor-libs` (179 kB): Router, TanStack Query, Zustand, TanStack Table,
         *   React Aria internals — all third-party logic deps that change only on upgrade.
         * - `vendor-aria` (54 kB): react-aria + react-stately — UI primitive layer,
         *   changes independently from app code.
         * - `index` (78 kB): app shell — changes on every deploy.
         *
         * This produces 3 vendor chunks + 1 app shell + N route chunks = ~4 base chunks.
         * With HTTP/2 multiplexing this is well within the sweet spot.
         */
        manualChunks(id: string) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "vendor-react";
          }
          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules/@tanstack/query-core") ||
            id.includes("node_modules/@tanstack/react-table") ||
            id.includes("node_modules/zustand") ||
            id.includes("node_modules/internmap") ||
            id.includes("node_modules/d3-")
          ) {
            return "vendor-libs";
          }
          if (
            id.includes("node_modules/react-aria") ||
            id.includes("node_modules/react-stately") ||
            id.includes("node_modules/@react-aria") ||
            id.includes("node_modules/@react-stately")
          ) {
            return "vendor-aria";
          }
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 3,
        minThreads: 1,
      },
    },
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            "react",
            "react-dom",
            "react-dom/client",
            "react-dom/server",
            "react-router-dom",
            "@tanstack/react-query",
            "react-aria",
            "react-stately",
          ],
        },
      },
    },
  },
});
