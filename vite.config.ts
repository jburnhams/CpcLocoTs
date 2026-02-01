import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Cpclocots',
      fileName: (format) => {
        if (format === 'es') return 'bundles/cpclocots.esm.js';
        return 'browser/cpclocots.min.js';
      },
      formats: ['es', 'iife'],
    },
    outDir: 'dist',
    emptyOutDir: false, // Keep existing files (cjs/esm from tsc)
    sourcemap: true,
    minify: true, // Minify both
    rollupOptions: {
      output: {
        // Ensure proper global variable name for IIFE
        extend: true,
      },
    },
  },
  resolve: {
    alias: {
      // Alias for integration tests if needed, but build shouldn't need mocks usually
    }
  }
});
