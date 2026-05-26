import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["@cofhe/sdk", "tweetnacl"],
  },
  worker: {
    format: "es",
  },
  server: {
    port: 5173,
  },
});
