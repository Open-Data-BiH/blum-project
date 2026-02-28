import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://blum.ba',
  output: 'static',
  trailingSlash: 'always',
  vite: {
    optimizeDeps: {
      include: ['leaflet'],
    },
  },
});
