import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // React app sẽ được serve tại /react/ trên cùng server với Magento (port 8081)
  base: '/react/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    // Build trực tiếp vào pub/react/ của Magento (phục vụ qua nginx /react/)
    outDir: '../pub/react',
    emptyOutDir: true,
    manifest: true,
  },
  server: {
    // Dev server port
    port: 5173,
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
      ],
    },
    // Proxy cho dev mode (khi chạy npm run dev riêng lẻ tại port 5173)
    proxy: {
      '/rest': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
      '/graphql': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})