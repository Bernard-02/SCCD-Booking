import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true
  },

  server: {
    port: 3000,
    open: true
  },

  // 設置 SPA 的歷史路由 fallback
  // 當訪問 /space、/equipment 等路徑時，返回 index.html 而非尋找 space.html 等檔案
  appType: 'spa'
})
