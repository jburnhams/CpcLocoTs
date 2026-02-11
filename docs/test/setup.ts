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
            (canvasEl as any)._uid = Math.random();
            // Patch this specific instance
            canvasEl.getContext = function (type: string) {
                if (type !== '2d') return null;
                if (!this._context) {
                    this._napiCanvas = createCanvas(this.width || 300, this.height || 150);
                    this._context = this._napiCanvas.getContext('2d');
                }
                return this._context;
            };
        }
        return el;
    };

    // Also patch prototype just in case
    if (typeof HTMLCanvasElement !== 'undefined') {
        const originalWidth = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
        const originalHeight = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');

        Object.defineProperty(HTMLCanvasElement.prototype, 'width', {
            set: function (val) {
                if (val !== (this as any)._lastWidth) {
                    if (originalWidth && originalWidth.set) originalWidth.set.call(this, val);
                    (this as any)._lastWidth = val;
                    this._napiCanvas = null; // Force recreation
                    this._context = null;
                }
            },
            get: function () {
                return originalWidth && originalWidth.get ? originalWidth.get.call(this) : (this._lastWidth || 0);
            },
            configurable: true
        });

        Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
            set: function (val) {
                if (val !== (this as any)._lastHeight) {
                    if (originalHeight && originalHeight.set) originalHeight.set.call(this, val);
                    (this as any)._lastHeight = val;
                    this._napiCanvas = null; // Force recreation
                    this._context = null;
                }
            },
            get: function () {
                return originalHeight && originalHeight.get ? originalHeight.get.call(this) : (this._lastHeight || 0);
            },
            configurable: true
        });

        HTMLCanvasElement.prototype.getContext = function (type: string) {
            if (type !== '2d') return null;
            if (!this._context) {
                this._napiCanvas = createCanvas(this.width || 300, this.height || 150);
                this._context = this._napiCanvas.getContext('2d');
            }
            return this._context;
        };
    }

    // Helper to setup DOM elements required by tests
    const setupDom = () => {
        const elements = [
            { id: "debugPauseButton", tag: "button" },
            { id: "debugResumeButton", tag: "button" },
            { id: "debugStepIntoButton", tag: "button" },
            { id: "debugStepOverButton", tag: "button" },
            { id: "debugStepOutButton", tag: "button" },
            { id: "debugCallStack", tag: "div" },
            { id: "debugCallStackList", tag: "ol" },
            { id: "debugSpeedInput", tag: "input" },
            { id: "debugModeInput", tag: "input" },
            { id: "debugBreakOnErrorInput", tag: "input" },
            { id: "debugAddBreakpointButton", tag: "button" },
            { id: "debugBreakpointInput", tag: "input" },
            { id: "debugBreakpointList", tag: "div" },
            { id: "debugLineLabel", tag: "span" },
            { id: "debugErrorInfo", tag: "div" },
            { id: "debugErrorText", tag: "span" },
            { id: "debugArea", tag: "fieldset" },
            { id: "cpcCanvas", tag: "canvas" },
            { id: "noCanvas", tag: "div" },
            { id: "textText", tag: "textarea" },
            { id: "cpcArea", tag: "div" },
            { id: "showCpcInput", tag: "input" },
            { id: "galleryAreaItems", tag: "div" },
            { id: "dropZone", tag: "div" },
            { id: "fileInput", tag: "input" },
            { id: "inputText", tag: "textarea" },
            { id: "outputText", tag: "textarea" },
            { id: "resultText", tag: "textarea" },
            { id: "inp2Text", tag: "textarea" },
            { id: "varSelect", tag: "select" },
            { id: "varText", tag: "textarea" },
            { id: "directorySelect", tag: "select" },
            { id: "exampleSelect", tag: "select" },
            { id: "databaseSelect", tag: "select" },
            { id: "disassText", tag: "textarea" },
            { id: "consoleLogText", tag: "textarea" },
            { id: "renumNewInput", tag: "input" },
            { id: "renumStartInput", tag: "input" },
            { id: "renumStepInput", tag: "input" },
            { id: "renumKeepInput", tag: "input" },
            { id: "exportFileSelect", tag: "select" },
            { id: "exportDSKFormatSelect", tag: "select" },
            { id: "exportTokenizedInput", tag: "input" },
            { id: "exportDSKInput", tag: "input" },
            { id: "exportDSKStripEmptyInput", tag: "input" },
            { id: "exportBase64Input", tag: "input" },
            { id: "prettySpaceInput", tag: "input" },
            { id: "prettyBracketsInput", tag: "input" },
            { id: "prettyColonsInput", tag: "input" },
            { id: "prettyLowercaseVarsInput", tag: "input" }
        ];

        elements.forEach(el => {
            if (!document.getElementById(el.id)) {
                const element = document.createElement(el.tag);
                element.id = el.id;
                const uid = Math.random();
                (element as any)._uid = uid;
                if (el.tag === 'canvas') {
                    console.log(`DEBUG: setupDom created canvas ${el.id} with UID ${uid}`);
                }
                document.body.appendChild(element);
            }
        });
    };
    setupDom();

} else {
    console.warn("document not found in global scope!");
}

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
    createGain: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0, setValueAtTime: vi.fn() } })),
    createChannelMerger: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createOscillator: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0, setValueAtTime: vi.fn() } })),
    createBuffer: vi.fn(() => ({ getChannelData: vi.fn(() => new Float32Array(100)) })),
    createBufferSource: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null })),
    createBiquadFilter: vi.fn(() => ({ connect: vi.fn(), frequency: { value: 0 } })),
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    close: vi.fn().mockImplementation(() => Promise.resolve()),
    state: 'running',
    resume: vi.fn(),
    currentTime: 0,
    sampleRate: 44100
}));

global.window.AudioContext = global.AudioContext;

// Mock other browser APIs if missing
global.jest = vi;
