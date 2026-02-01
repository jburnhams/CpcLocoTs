const path = require('node:path');
const assert = require('node:assert');

const cjsPath = path.join(__dirname, '..', 'dist', 'cjs', 'index.cjs');
const mod = require(cjsPath);

assert.strictEqual(typeof mod.CpcLoco, 'function', 'CJS build should export CpcLoco class');

console.log('cjs smoke test passed');
