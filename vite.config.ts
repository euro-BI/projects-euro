import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/microsoft-token': {
        target: 'https://login.microsoftonline.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/microsoft-token/, ''),
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            proxyReq.removeHeader('Origin');
            proxyReq.removeHeader('Referer');
          });
        },
      },
      '/powerbi-api': {
        target: 'https://api.powerbi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/powerbi-api/, ''),
        secure: false,
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "robots.txt", "icons/app-icon.png"],
      manifest: {
        name: "Hub - Eurostock",
        short_name: "Hub Eurostock",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#FAC017",
        orientation: "portrait",
        icons: [
          {
            src: "https://rzdepoejfchewvjzojan.supabase.co/storage/v1/object/public/fotos/fotos/fotos-escudos/bot.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
