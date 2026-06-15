import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(__dirname, "web"),
  base: "/",
  build: {
    outDir: resolve(__dirname, "dist/web"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "web/index.html"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:27183",
      "/ws": { target: "ws://127.0.0.1:27183", ws: true },
      "/render": "http://127.0.0.1:27183",
      "/t": "http://127.0.0.1:27183",
    },
  },
});
