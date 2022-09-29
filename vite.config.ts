import { defineConfig } from "vite"
import { resolve } from "path"
import react from "@vitejs/plugin-react"
import dts from "vite-plugin-dts"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    dts({
      entryRoot: resolve(__dirname, "src/lib"),
      insertTypesEntry: true,
    }),
    react(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "index.ts"),
      name: "iframeMsgPromise",
      // the proper extensions will be added
      fileName: "index",
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: ["react"],
    },
  },
})
