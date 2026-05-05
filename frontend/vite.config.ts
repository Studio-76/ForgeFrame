/// <reference types="vitest" />
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tailwindcss(), react()],
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
