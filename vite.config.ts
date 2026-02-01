import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig(() => {
  const target = process.env.APP_BUILD_TARGET;

  if (target === 'lib') {
    return {
      plugins: [
        dts({
          tsconfigPath: './tsconfig.build.json',
          outDir: 'dist/types',
          insertTypesEntry: true,
        })
      ],
      build: {
        minify: false,
        lib: {
          entry: path.resolve(__dirname, 'src/index.ts'),
          formats: ['es', 'cjs'],
          fileName: (format) => {
            if (format === 'es') return 'bundles/cpclocots.esm.js';
            if (format === 'cjs') return 'cjs/index.cjs';
            return `cpclocots.${format}.js`;
          }
        },
        outDir: 'dist',
        emptyOutDir: false,
      }
    };
  }

  if (target === 'browser') {
     return {
      build: {
        minify: false,
        lib: {
          entry: path.resolve(__dirname, 'src/index.ts'),
          name: 'Cpclocots',
          formats: ['iife'],
          fileName: () => 'browser/cpclocots.js'
        },
        outDir: 'dist',
        emptyOutDir: false,
      }
    };
  }

  if (target === 'browser-min') {
     return {
      build: {
        minify: true,
        lib: {
          entry: path.resolve(__dirname, 'src/index.ts'),
          name: 'Cpclocots',
          formats: ['iife'],
          fileName: () => 'browser/cpclocots.min.js'
        },
        outDir: 'dist',
        emptyOutDir: false,
      }
    };
  }

  return {};
});
