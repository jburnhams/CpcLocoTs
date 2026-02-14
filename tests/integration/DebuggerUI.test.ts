
import { describe, it, expect } from "vitest";
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
const distDir = path.join(projectRoot, 'dist');
const esmBundlePath = path.join(distDir, 'bundles', `${libraryName}.esm.js`);

const localStorageMock = {
  getItem: () => null,
  setItem: () => { },
  removeItem: () => { },
  clear: () => { },
  length: 0,
  key: () => null
};

describe("Debugger UI Integration", () => {
	async function loadBundleModule() {
		// Mock globals needed for ESM side effects
		(global as any).window = (global as any).window || {};
		(global as any).Polyfills = (global as any).Polyfills || { console: console, isNodeAvailable: true };
		(global as any).window.Polyfills = (global as any).Polyfills;
		(global as any).window.localStorage = localStorageMock;
		(global as any).Polyfills.localStorage = localStorageMock;

		if (!fs.existsSync(esmBundlePath)) {
			throw new Error("ESM bundle not found. Run `npm run build` first.");
		}

		const moduleUrl = pathToFileURL(esmBundlePath);
		return await import(moduleUrl.href);
	}

	it("should export Debugger class", async () => {
		const bundle = await loadBundleModule();
		expect(bundle.Debugger).toBeDefined();
	});

	it("should export Evaluator class", async () => {
		const bundle = await loadBundleModule();
		expect(bundle.Evaluator).toBeDefined();
	});
});
