import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['test/Integration*.test.ts'],
        // No alias here, so it resolves to real cpclocots
        setupFiles: ['./test/setup.ts'],
        poolOptions: {
            threads: {
                singleThread: false // Run integration tests in separate threads to isolate memory
            },
            forks: {
                singleFork: false
            }
        }
    }
});
