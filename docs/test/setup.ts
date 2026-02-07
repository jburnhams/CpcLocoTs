// @ts-nocheck
import { vi } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';

console.log("Setup.ts running...");

if (typeof document !== 'undefined') {
    console.log("Patching document.createElement...");
    const origCreateElement = document.createElement.bind(document);
    document.createElement = (tagName: string, options?: ElementCreationOptions) => {
        const el = origCreateElement(tagName, options);
        if (tagName.toLowerCase() === 'canvas') {
            const canvasEl = el as HTMLCanvasElement;
            Object.defineProperty(canvasEl, 'offsetParent', {
                get() { return document.body; } // Mock offsetParent to be truthy
            });
            canvasEl.getContext = function (type: string) {
                if (!this._context) {
                    this._napiCanvas = createCanvas(this.width || 300, this.height || 150);
                    this._context = this._napiCanvas.getContext(type);
                }
                return this._context;
            }.bind(canvasEl);

            canvasEl.toDataURL = function () {
                if (this._napiCanvas) {
                    return this._napiCanvas.toDataURL();
                }
                return "";
            }.bind(canvasEl);
        }
        return el;
    };
} else {
    console.warn("document not found in global scope!");
}

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
    createGain: vi.fn(() => ({ connect: vi.fn(), gain: { value: 0 } })),
    createOscillator: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } })),
    destination: {},
    close: vi.fn(),
    state: 'running',
    resume: vi.fn(),
    currentTime: 0
}));

global.window.AudioContext = global.AudioContext;

// Mock other browser APIs if missing
global.jest = vi;
