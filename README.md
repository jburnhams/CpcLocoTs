# CpcLocoTs - Run CPC BASIC in a Browser

**CpcLocoTs** (formerly CPCBasicTS) is a production-ready TypeScript library that lets you run Amstrad CPC 6128 Locomotive BASIC 1.1 programs in a modern browser.

BASIC programs are compiled to JavaScript for high performance, utilizing a robust implementation of the CPC's hardware and command set.

## Features

- **High-Performance Compilation**: Translates BASIC directly to JavaScript for warp-speed execution.
- **Unchained Experience**: Breaks out of the original CPC restrictions while maintaining compatibility.
- **Modern Tooling**: Built with TypeScript, Vitest, and modern build targets (ESM, CJS, Browser).
- **Comprehensive Hardware Support**: Implements graphics (Mode 0-3), sound (AY-3-8910), keyboard, and disk I/O.
- **Developer Friendly**: Includes a full IDE-like experience with source editing, renumbering, and pretty-printing.

## Getting Started

### Installation

```bash
npm install cpclocots
```

### Basic Usage

```typescript
import { Controller, Model, View } from 'cpclocots';

// Initialize the engine
const model = new Model();
const view = new View();
const controller = new Controller(model, view);

// Start the engine
controller.onDatabaseSelectChange();
```

## Development

### Available Scripts

- `npm run build` - Build all formats (ESM, CJS, bundles)
- `npm test` - Run unit tests with Vitest and JSDOM
- `npm run dev -w docs` - Run the documentation/examples dev server
- `npm run size` - Check bundle size limits

### Project Structure

```
.
├── src/                 # TypeScript source code
├── tests/               # Vitest unit and integration tests
├── docs/                # Documentation and examples (Vite project)
├── dist/                # Build artifacts (ESM, CJS, Bundles)
└── scripts/             # Build and utility scripts
```

## Distribution Formats

- **ESM**: `dist/esm/index.js`
- **CommonJS**: `dist/cjs/index.cjs`
- **Browser (IIFE)**: `dist/browser/cpclocots.min.js`
- **Browser (ESM)**: `dist/bundles/cpclocots.esm.js`

## Acknowledgments

CpcLocoTs is based on the work of **Marco Vieth**, originally developed as `CPCBasicTS`.

## License

MIT
