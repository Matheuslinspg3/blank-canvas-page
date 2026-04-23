import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { versionJsonPlugin } from "./plugins/versionJsonPlugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  optimizeDeps: {
    include: ['next-themes'],
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png", "apple-touch-icon.png"],
      manifest: {
        id: "/porta-pwa",
        name: "Porta do Corretor — Central de Performance",
        short_name: "Porta",
        description: "CRM, gestão de leads e anúncios para corretores que querem vender mais.",
        theme_color: "#D62828",
        background_color: "#f0f2f5",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/dashboard",
        categories: ["business", "productivity"],
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        navigateFallbackDenylist: [/^\/~oauth/, /^\/push\//, /^\/OneSignalSDK/],
      globIgnores: ["**/OneSignalSDKWorker.js", "**/push/**", "**/firebase-messaging-sw.js", "**/version.json"],
        runtimeCaching: [
          {
            urlPattern: /\/version\.json/,
            handler: "NetworkOnly",
          },
          // Hashed JS/CSS chunks — StaleWhileRevalidate so a missing precache entry
          // (e.g. after a partial deploy) still gets a network fetch fallback.
          // Only cache 200s — never cache 404/HTML SPA fallbacks for JS assets.
          {
            urlPattern: /\/assets\/.*\.(?:js|css)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-assets-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "gstatic-fonts-cache", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/pub-.*\.r2\.dev\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "r2-images-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/functions\/v1\/cloudinary-image-proxy/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "cloudinary-proxy-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/rest\/v1\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': [
            '@radix-ui/react-dialog', '@radix-ui/react-popover',
            '@radix-ui/react-select', '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip', '@radix-ui/react-dropdown-menu',
          ],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable'],
        },
      },
    },
  },
}));
