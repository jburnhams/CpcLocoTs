import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCanvas, ImageData } from '@napi-rs/canvas';
import { ViewID, View } from 'cpclocots';
import { CpcLoco } from '../src/main';

describe('Integration Simple: Initialization with Real Canvas', () => {
    let rsCanvas: any;
    let rsCtx: any;

    beforeEach(() => {
        // 1. Reset DOM using global document
        document.body.innerHTML = `
            <div id="${ViewID.mainArea}">
                <div id="${ViewID.cpcArea}" tabindex="0">
                    <canvas id="${ViewID.cpcCanvas}" width="640" height="400"></canvas>
                </div>
                <div id="${ViewID.kbdArea}">
                    <div id="${ViewID.kbdAreaInner}">
                        <div id="${ViewID.kbdAlpha}"></div>
                        <div id="${ViewID.kbdNum}"></div>
                    </div>
                </div>
                <!-- Other required elements -->
                <div id="${ViewID.outputArea}"></div>
                <div id="${ViewID.consoleLogText}"></div>
                <textarea id="${ViewID.inputText}"></textarea>
                <div id="${ViewID.statusText}"></div>
                <select id="${ViewID.databaseSelect}"><option value="basic">basic</option></select>
                <select id="${ViewID.directorySelect}"><option value=""></option></select>
                <select id="${ViewID.exampleSelect}"><option value=""></option></select>
                <button id="${ViewID.runButton}"></button>
                <button id="${ViewID.parseRunButton}"></button>
                <button id="${ViewID.stopButton}"></button>
                <button id="${ViewID.continueButton}"></button>
                <button id="${ViewID.resetButton}"></button>
                <div id="${ViewID.dropZone}"></div>
                <input type="file" id="${ViewID.fileInput}"></input>
                <select id="${ViewID.varSelect}"></select>
                <select id="${ViewID.varText}"></select>
                <input id="${ViewID.renumNewInput}"></input>
                <input id="${ViewID.renumStartInput}"></input>
                <input id="${ViewID.renumStepInput}"></input>
                <input id="${ViewID.renumKeepInput}"></input>
                <textarea id="${ViewID.inp2Text}"></textarea>
                <textarea id="${ViewID.disassText}"></textarea>
                <button id="${ViewID.undoButton}"></button>
                <button id="${ViewID.undoButton2}"></button>
                <button id="${ViewID.redoButton}"></button>
                <button id="${ViewID.redoButton2}"></button>
            </div>
        `;

        // 2. Create napi-rs canvas
        rsCanvas = createCanvas(640, 400);
        rsCtx = rsCanvas.getContext('2d');

        // 3. Patch the canvas element in the DOM
        const cpcCanvas = document.getElementById(ViewID.cpcCanvas) as HTMLCanvasElement;

        // Patch getContext to return napi-rs context
        const originalGetContext = cpcCanvas.getContext;
        cpcCanvas.getContext = ((type: string, options?: any) => {
            if (type === '2d') {
                return rsCtx as any;
            }
            return originalGetContext.call(cpcCanvas, type, options);
        }) as any;

        // Patch toDataURL
        cpcCanvas.toDataURL = rsCanvas.toDataURL.bind(rsCanvas);

        // 4. Mocks
        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);

        // AudioContext mock (override setup.ts)
        window.AudioContext = vi.fn().mockImplementation(() => ({
            createGain: vi.fn(() => ({ connect: vi.fn(), gain: { value: 0 } })),
            createChannelMerger: vi.fn(() => ({ connect: vi.fn() })),
            createOscillator: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } })),
            destination: {},
            close: vi.fn(),
            state: 'running',
            resume: vi.fn(),
            currentTime: 0
        })) as any;

        // 5. Mock offsetParent if needed (though global JSDOM usually handles this better, check if needed)
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
            get() {
                return this.parentNode;
            },
            configurable: true
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // Clean up body?
        document.body.innerHTML = '';
    });

    it('should initialize CpcLoco correctly with a real canvas context', async () => {
        // Start App
        await CpcLoco.fnDoStart();

        // Check if controller is initialized
        expect(CpcLoco.controller).toBeDefined();

        // Check if VM exists
        const vm = CpcLoco.controller.controller.getVm();
        expect(vm).toBeDefined();

        // Check if we can get canvas from View
        const canvasFromView = View.getElementById1(ViewID.cpcCanvas);
        expect(canvasFromView).toBeDefined();
    });
});
