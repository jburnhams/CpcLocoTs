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
    createGain: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0 } })),
    createChannelMerger: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createOscillator: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } })),
    destination: {},
    close: vi.fn().mockImplementation(() => Promise.resolve()),
    state: 'running',
    resume: vi.fn(),
    currentTime: 0
}));

global.window.AudioContext = global.AudioContext;

// Mock other browser APIs if missing
global.jest = vi;
