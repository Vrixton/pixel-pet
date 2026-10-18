import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  minify: true,
  injectStyle: true,
  loader: {
    '.png': 'dataurl',
  },
});