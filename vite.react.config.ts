import { defineConfig } from "vite"
import { resolve } from "path"

// Build for the `iframe-msg-promise/react` entry. The entry lives under src/
// rather than at the repo root: a root-level `react.ts` shadows the `react`
// package for Vite's dependency scanner and breaks `yarn dev`. Runs after the core build
// with `emptyOutDir: false` so both land in the same dist/.
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/react/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "react.js" : "react.cjs"),
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
  },
})
