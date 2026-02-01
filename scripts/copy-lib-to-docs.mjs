import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const srcDir = path.join(projectRoot, 'dist', 'browser');
const destDir = path.join(projectRoot, 'docs', 'public');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const files = [
  'cpclocots.js',
  'cpclocots.js.map',
  'cpclocots.min.js',
  'cpclocots.min.js.map'
];

for (const file of files) {
  const srcFile = path.join(srcDir, file);
  const destFile = path.join(destDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`Copied ${file} to docs/public`);
  } else {
    console.warn(`Warning: ${file} not found in dist/browser`);
  }
}
