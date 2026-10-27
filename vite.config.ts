import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Rutas relativas: funciona en https://usuario.github.io/CertiRecall/ sin configurar el nombre del repo.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'CertiRecall',
        short_name: 'CertiRecall',
        description: 'Estudio con recuerdo activo y repetición espaciada para la certificación de Claude.',
        theme_color: '#252a32',
        background_color: '#f6f4f0',
        display: 'standalone',
        start_url: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      },
      workbox: {
        // El temario se guarda en caché para estudiar sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,json}']
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
