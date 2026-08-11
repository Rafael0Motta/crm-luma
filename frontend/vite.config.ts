import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        name: "Luma Benefícios · CRM",
        short_name: "Luma CRM",
        description: "CRM conversacional da Luma Benefícios",
        lang: "pt-BR",
        start_url: "/",
        display: "standalone",
        background_color: "#071A1E",
        theme_color: "#071A1E",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Apenas ativos estaticos do build sao pre-cacheados. Chamadas de API e o
        // stream SSE (/events/stream) seguem direto para a rede, sem interceptacao.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallbackDenylist: [/^\/uploads\//],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
