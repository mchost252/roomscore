import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh for development
      fastRefresh: true,
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    // Use hidden sourcemaps in production (smaller bundle, still debuggable)
    sourcemap: 'hidden',
    // Target modern browsers for smaller bundle
    target: 'es2020',
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
    },
    // Manual chunk splitting for optimal caching
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - changes rarely
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // MUI - large but stable
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          // Charts - only needed on specific pages
          'vendor-charts': ['recharts'],
          // Real-time features
          'vendor-realtime': ['socket.io-client', 'axios'],
          // Date utilities
          'vendor-utils': ['date-fns'],
        },
        // Optimize chunk file names for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/${chunkInfo.name}-[hash].js`;
        },
        // Optimize asset file names
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      'axios',
      'socket.io-client',
      'date-fns',
    ],
    // Exclude large optional dependencies
    exclude: [],
  },
  // Enable CSS code splitting
  css: {
    devSourcemap: true,
  },
  // Preview server config (for testing production build locally)
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
});
