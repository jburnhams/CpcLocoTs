import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const esmPath = path.join(__dirname, '..', 'dist', 'bundles', 'cpclocots.esm.js');
const mod = await import(pathToFileURL(esmPath).href);

assert.strictEqual(typeof mod.CpcLoco, 'function', 'ESM build should export CpcLoco class');

console.log('esm smoke test passed');
