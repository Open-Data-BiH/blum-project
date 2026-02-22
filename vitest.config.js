import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['js/**/*.js'],
            exclude: ['node_modules/**', 'tests/**', 'data/**', 'js/page-init.js'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 75,
                statements: 80,
            },
        },
        setupFiles: ['./tests/unit/setup.js'],
    },
});
