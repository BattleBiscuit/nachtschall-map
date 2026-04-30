import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  server: {
    host: '0.0.0.0', // Listen on all interfaces for Docker
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true // Required for Docker volume mounts
    },
    proxy: {
      // Proxy WebSocket and API requests to backend during development
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'd3': ['d3'],
          'socket.io': ['socket.io-client']
        }
      }
    }
  }
})
