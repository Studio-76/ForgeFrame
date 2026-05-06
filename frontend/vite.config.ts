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
         * - `vendor-react`: React + React-DOM — stable and always app-shell loaded.
         * - `vendor-router`: React Router — stable and app-shell loaded.
         * - `vendor-query`: TanStack Query — stable and app-shell loaded.
         * - `vendor-state`: Zustand — small client-state runtime, app-shell loaded.
         * - `vendor-aria`: React Aria/Stately — UI primitive layer used by shell chrome.
         * - `vendor-table`: TanStack Table — route-loaded with table surfaces only.
         *
         * Keeping TanStack Table out of the router/query chunk prevents table code from
         * being preloaded for the initial app shell while retaining cache-friendly vendor
         * chunks for long-lived dependencies.
         */
        manualChunks(id: string) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "vendor-react";
          }
          if (
            id.includes("node_modules/@tanstack/react-table") ||
            id.includes("node_modules/@tanstack/table-core")
          ) {
            return "vendor-table";
          }
          if (
            id.includes("node_modules/@tanstack/react-query") ||
            id.includes("node_modules/@tanstack/query-core")
          ) {
            return "vendor-query";
          }
          if (
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/react-router-dom/")
          ) {
            return "vendor-router";
          }
          if (id.includes("node_modules/zustand")) {
            return "vendor-state";
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
