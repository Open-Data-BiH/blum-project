import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://blprevoz.com/',
    base: '/blum-project',
    output: 'static',
    trailingSlash: 'always',
    vite: {
        optimizeDeps: {
            include: ['leaflet'],
        },
    },
});
