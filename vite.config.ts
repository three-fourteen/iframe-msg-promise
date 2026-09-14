/// <reference types="vitest" />
import { defineConfig } from "vite"
import { resolve } from "path"
import react from "@vitejs/plugin-react"
import dts from "vite-plugin-dts"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    dts({
      entryRoot: resolve(__dirname, "src/lib"),
      exclude: ["src/lib/__tests__/**"],
      insertTypesEntry: true,
    }),
    // Only the demo app uses React; the library itself has no dependencies.
    react(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "index.ts"),
      name: "iframeMsgPromise",
      // the proper extensions will be added
      fileName: "index",
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/lib/__tests__/**/*.test.ts"],
  },
})
