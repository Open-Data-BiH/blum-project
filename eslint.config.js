import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                history: 'readonly',
                module: 'readonly',
                alert: 'readonly',
                AbortController: 'readonly',
                Element: 'readonly',
                Image: 'readonly',
                HTMLElement: 'readonly',
                CustomEvent: 'readonly',
                Event: 'readonly',
                MutationObserver: 'readonly',
                IntersectionObserver: 'readonly',
                ResizeObserver: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                // Libraries loaded via CDN
                L: 'readonly', // Leaflet
                DOMPurify: 'readonly',
                // App globals
                urbanBusRoutes: 'readonly',
                FetchHelper: 'readonly',
                escapeHTML: 'readonly',
                sanitizeURL: 'readonly',
                sanitizeHTML: 'readonly',
                safeInnerHTML: 'readonly',
                BaseComponent: 'readonly',
                MapLegendControl: 'readonly',
                currentLang: 'writable',
                translations: 'writable',
                safeGet: 'readonly',
                // Feature module globals
                AppUtils: 'readonly',
                AppI18n: 'readonly',
                LinesService: 'readonly',
                LinesUI: 'readonly',
                PricingService: 'readonly',
                PricingUI: 'readonly',
                TimetablesService: 'readonly',
                TimetablesUI: 'readonly',
                ContactsFeature: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'no-undef': 'error',
            eqeqeq: ['error', 'always'],
            curly: ['error', 'all'],
            'no-var': 'error',
            'prefer-const': 'error',
        },
    },
    {
        files: [
            'js/fetch-helper.js',
            'js/sanitize.js',
            'js/i18n/i18n.js',
            'js/components/base-component.js',
            'js/components/map-legend-control.js',
        ],
        rules: {
            'no-redeclare': 'off',
        },
    },
    {
        ignores: ['node_modules/**', 'data/**/*.js', 'eslint.config.js'],
    },
];
