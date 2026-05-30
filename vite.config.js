import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    proxy: {
      '/v1': {
        target: 'https://api.xuegao.site',
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
})
