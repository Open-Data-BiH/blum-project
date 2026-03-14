import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'happy-dom',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['node_modules/**', 'tests/**', 'dist/**', 'src/**/*.d.ts'],
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
