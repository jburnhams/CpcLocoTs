import { describe, test, expect } from 'vitest';
import vm from 'node:vm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find project root by looking for package.json
let projectRoot = __dirname;
while (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
  const parent = path.dirname(projectRoot);
  if (parent === projectRoot) {
    throw new Error('Could not find package.json');
  }
  projectRoot = parent;
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const libraryName = packageJson.name;
const globalName = toPascalCase(libraryName);

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Path to the generated bundles
const distDir = path.join(projectRoot, 'dist');
const iifeBundlePath = path.join(distDir, 'browser', `${libraryName}.min.js`);
const esmBundlePath = path.join(distDir, 'bundles', `${libraryName}.esm.js`);

describe('Browser Bundle Tests', () => {
  test('IIFE bundle attaches global namespace', () => {
    expect(fs.existsSync(iifeBundlePath), 'Minified bundle should exist. Run `npm run build` first.').toBeTruthy();

    const bundleCode = fs.readFileSync(iifeBundlePath, 'utf8');
    const context: Record<string, any> = { window: {}, globalThis: {}, Polyfills: { isNodeAvailable: false, console: console } };
    vm.createContext(context);

    expect(() => {
      vm.runInContext(bundleCode, context);
    }).not.toThrow();

    const globalApi = context.window['CpcLoco'] ?? context.globalThis['CpcLoco'];
    expect(globalApi).toBeTruthy();
    expect(typeof globalApi.addIndex).toBe('function');
    expect(typeof globalApi.addItem).toBe('function');
  });

  test('ESM bundle can be imported directly', async () => {
    expect(fs.existsSync(esmBundlePath), 'ESM bundle should exist. Run `npm run build` first.').toBeTruthy();

    // We need to mock global window/Polyfills for the ESM import side-effects
    (global as any).window = (global as any).window || {};
    (global as any).Polyfills = (global as any).Polyfills || { console: console, isNodeAvailable: true };
    (global as any).window.Polyfills = (global as any).Polyfills;

    const moduleUrl = pathToFileURL(esmBundlePath).href;
    const mod = await import(moduleUrl);

    expect(mod.CpcLoco).toBeTruthy();
    expect(typeof mod.CpcLoco.addIndex).toBe('function');
  });

  test('bundle size is reasonable', () => {
    const stats = fs.statSync(iifeBundlePath);
    const sizeKB = stats.size / 1024;

    // Bundle should be less than 500KB (increased for real app)
    expect(sizeKB).toBeLessThan(500);

    // Bundle should be more than 10KB (sanity check)
    expect(sizeKB).toBeGreaterThan(10);
  });
});

describe('Functional Tests - Verify Bundle Works Correctly', () => {
  // Helper to load the bundle and get its imports
  async function loadBundleModule() {
    // We need to mock global window/Polyfills for the ESM import side-effects
    (global as any).window = (global as any).window || {};
    (global as any).Polyfills = (global as any).Polyfills || { console: console, isNodeAvailable: true };
    (global as any).window.Polyfills = (global as any).Polyfills;

    const moduleUrl = pathToFileURL(esmBundlePath);
    return await import(moduleUrl.href);
  }

  test('CpcLoco class is exported in browser bundle', async () => {
    const bundle = await loadBundleModule();
    expect(bundle.CpcLoco).toBeDefined();
    expect(typeof bundle.CpcLoco.fnOnLoad).toBe('function');
  });
});

