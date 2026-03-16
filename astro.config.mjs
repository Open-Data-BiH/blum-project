import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
    site: 'https://blprevoz.com/',
    base: '/',
    output: 'static',
    trailingSlash: 'always',
    redirects: {
        '/lines': '/linije',
        '/lines/[lineId]': '/linija/[lineId]',
        '/pricing': '/cjenovnik',
        '/airport': '/aerodrom',
        '/faq': '/cesta-pitanja',
        '/updates': '/obavjestenja',
        '/contact': '/kontakt',
        '/privacy': '/politika-privatnosti',
        '/about': '/o-projektu',
    },
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
