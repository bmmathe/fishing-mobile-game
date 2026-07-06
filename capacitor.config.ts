import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bitforgeventures.fishinggame",
  appName: "Mythic Fishing",
  // Vite builds the web app into dist/; Capacitor copies this into the native
  // shell on `cap sync`.
  webDir: "dist",
};

export default config;
