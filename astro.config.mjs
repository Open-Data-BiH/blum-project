import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
    site: 'https://blprevoz.com/',
    base: '/',
    output: 'static',
    trailingSlash: 'always',
    integrations: [sitemap()],
    vite: {
        optimizeDeps: {
            include: ['leaflet'],
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        leaflet: ['leaflet'],
                    },
                },
            },
        },
    },
});
