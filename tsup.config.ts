import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  minify: true,
  injectStyle: true, // Inyecta el CSS automáticamente al importar el paquete
  loader: {
    '.png': 'dataurl', // Convierte el sprite a Base64 para no lidiar con rutas de imágenes en proyectos ajenos
  },
});