import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      // Map @shared/* -> <repo-root>/shared/*
      '@shared': resolve(__dirname, '../../shared'),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    middlewareMode: false,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      // Global chat WebSocket
      '/api/chat/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
