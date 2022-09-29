import { defineConfig } from "vite"
import { resolve } from "path"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
