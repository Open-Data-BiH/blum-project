import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://open-data-bih.github.io/blum-project',
    output: 'static',
    trailingSlash: 'always',
    vite: {
        optimizeDeps: {
            include: ['leaflet'],
        },
    },
});
