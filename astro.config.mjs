import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
    site: 'https://blprevoz.com/',
    base: '/',
    output: 'static',
    trailingSlash: 'always',
    redirects: {
        '/lines': '/linije',
        '/pricing': '/cjenovnik',
        '/airport': '/aerodrom',
        '/faq': '/cesta-pitanja',
        '/updates': '/obavjestenja',
        '/contact': '/kontakt',
        '/privacy': '/politika-privatnosti',
        '/about': '/o-projektu',
    },
    integrations: [
        sitemap({
            filter: (page) => !page.startsWith('https://blprevoz.com/lines/'),
        }),
    ],
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
