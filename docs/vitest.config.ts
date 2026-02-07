import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['test/**/*.test.ts'],
        exclude: ['test/Integration*.test.ts'], // Exclude integration tests
        alias: {
            'cpclocots': path.resolve(__dirname, './__mocks__/cpclocots.ts')
        }
    }
});
