import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    proxy: {
      "/v1/api": {
        target: "http://localhost:4321",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/v1\/api/, ""),
      },
    },
  },
});
