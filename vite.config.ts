/// <reference types="vitest" />
import { defineConfig } from "vite"
import { resolve } from "path"
import react from "@vitejs/plugin-react"

// Library build for the core entry. Declarations for every entry are emitted
// by `tsc -p tsconfig.build.json` so that cross-entry types resolve.
// https://vitejs.dev/config/
export default defineConfig({
  // Only the demo app uses React; the core library has no dependencies.
  // Fast Refresh injects globals the test environment does not provide.
  plugins: [react({ fastRefresh: !process.env.VITEST })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/lib/index.ts"),
      name: "iframeMsgPromise",
      // the proper extensions will be added
      fileName: "index",
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
