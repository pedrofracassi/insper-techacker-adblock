import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import zipPack from "vite-plugin-zip-pack";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    webExtension({
      browser: "firefox",
    }),
    zipPack(),
  ],
  build: {
    sourcemap: "inline",
  },
});
