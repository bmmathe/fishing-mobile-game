import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the built assets load correctly inside the Capacitor
  // WebView (served from a file:// or capacitor:// origin), not just from a
  // web server root.
  base: "./",
  server: {
    host: true,
  },
});
