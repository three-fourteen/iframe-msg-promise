import { defineConfig } from "vite"
import { resolve } from "node:path"

// Standalone UMD build of the core entry, for <script> tags and CDNs. UMD does
// not support multiple entries, so it gets its own pass; the React hooks are
// deliberately not exposed this way.
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/lib/index.ts"),
      name: "iframeMsgPromise",
      formats: ["umd"],
      fileName: () => "index.umd.cjs",
    },
  },
})
