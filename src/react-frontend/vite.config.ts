import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readGoogleClientIdFromCustomEnv(): string {
  const customEnvPath = path.resolve(__dirname, '../env/custom.env')

  if (!fs.existsSync(customEnvPath)) {
    return ''
  }

  const content = fs.readFileSync(customEnvPath, 'utf8')
  const match = content.match(/^\s*GOOGLE_OAUTH_CLIENT_ID\s*=\s*(.+)\s*$/m)

  if (!match) {
    return ''
  }

  return match[1].trim().replace(/^['"]|['"]$/g, '')
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const resolvedGoogleClientId = [
    (process.env.VITE_GOOGLE_CLIENT_ID ?? '').trim(),
    (env.VITE_GOOGLE_CLIENT_ID ?? '').trim(),
    (env.GOOGLE_OAUTH_CLIENT_ID ?? '').trim(),
    readGoogleClientIdFromCustomEnv(),
  ].find((value) => value.length > 0) ?? ''

  return {
    // React app sẽ được serve tại /react/ trên cùng server với Magento (port 8081)
    base: '/react/',
    define: {
      __FRESO_GOOGLE_CLIENT_ID__: JSON.stringify(resolvedGoogleClientId),
    },
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
      headers: {
        // Allow popup-based auth providers (Google Identity Services) to postMessage back to opener.
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
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
  }
})