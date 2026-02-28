import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const browserGlobals = {
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
};

const baseRules = {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'no-undef': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'no-var': 'error',
    'prefer-const': 'error',
};

export default [
    {
        ignores: ['node_modules/**', 'dist/**', '.astro/**', 'eslint.config.js', '**/*.astro'],
    },
    js.configs.recommended,
    {
        files: ['src/**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: browserGlobals,
        },
        rules: baseRules,
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
            },
            globals: browserGlobals,
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
];
