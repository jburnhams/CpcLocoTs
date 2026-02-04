// setup.ts
import { expect, afterEach } from 'vitest';
// import { cleanup } from '@testing-library/dom';
// import '@testing-library/jest-dom/vitest'; // If avail

// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
    document.body.innerHTML = '';
});
