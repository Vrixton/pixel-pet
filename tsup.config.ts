import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  minify: true,
  banner: {
    js: "'use client';",
  },
  loader: {
    '.png': 'file',
  },
});