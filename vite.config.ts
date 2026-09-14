/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"

// Library build. Both entries are built together so the core is emitted once
// and shared, rather than inlined into each bundle. Declarations come from
// `tsc -p tsconfig.build.json` so cross-entry types resolve.
// https://vite.dev/config/
export default defineConfig({
  // Only the demo app uses React; the core library has no dependencies.
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/lib/index.ts"),
        react: resolve(import.meta.dirname, "src/react/index.ts"),
      },
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
