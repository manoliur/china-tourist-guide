import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: {
    // Контент — JSON, а не бинарники; поднимаем лимит инлайна, чтобы не плодить лишних запросов.
    assetsInlineLimit: 0,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.png", "icon-192.png", "icon-512.png", "icon-512-maskable.png",
        "fonts/*.woff2",
      ],
      manifest: {
        name: "Справочник туриста в Китае",
        short_name: "Китай-справочник",
        description: "Офлайн-справочник: экстренная помощь, законы, Alipay, транспорт, безвиз — для туриста из России в Китае.",
        theme_color: "#0a0a0d",
        background_color: "#0a0a0d",
        display: "standalone",
        start_url: ".",
        scope: ".",
        lang: "ru",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Весь контент (JSON) и вся оболочка приложения — в precache,
        // это и есть требование "работает полностью офлайн".
        globPatterns: ["**/*.{js,css,html,json,png,svg,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
