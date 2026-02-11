import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { ViewID, Utils } from 'cpclocots';
import { CpcLoco } from '../src/main';

describe('Canvas Isolated Memory Test', () => {
    let rsCanvas: any;
    let rsCtx: any;

    beforeEach(() => {
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
                <div id="${ViewID.outputArea}"></div>
                <textarea id="${ViewID.outputText}"></textarea>
                <div id="${ViewID.consoleLogText}"></div>
                <textarea id="${ViewID.inputText}"></textarea>
                <div id="${ViewID.statusText}"></div>
                <button id="${ViewID.runButton}"></button>
                <button id="${ViewID.stopButton}"></button>
                <button id="${ViewID.continueButton}"></button>
                <button id="${ViewID.resetButton}"></button>
                <button id="${ViewID.parseRunButton}"></button>
                <div id="${ViewID.dropZone}"></div>
                <input type="file" id="${ViewID.fileInput}"></input>
                <select id="${ViewID.databaseSelect}"></select>
                <select id="${ViewID.directorySelect}"></select>
                <select id="${ViewID.exampleSelect}"></select>
                <div id="${ViewID.resultText}"></div>
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
                <!-- Debug elements -->
                <fieldset id="${ViewID.debugArea}" class="displayNone">
                    <input id="${ViewID.debugSpeedInput}" type="range"></input>
                    <span id="${ViewID.debugLineLabel}"></span>
                    <button id="${ViewID.debugPauseButton}"></button>
                    <button id="${ViewID.debugResumeButton}"></button>
                    <button id="${ViewID.debugStepIntoButton}"></button>
                    <button id="${ViewID.debugStepOverButton}"></button>
                    <button id="${ViewID.debugStepOutButton}"></button>
                    <div id="${ViewID.debugCallStack}">
                        <ol id="${ViewID.debugCallStackList}"></ol>
                    </div>
                    <input id="${ViewID.debugModeInput}" type="checkbox"></input>
                    <div id="${ViewID.debugBreakpointList}"></div>
                    <input id="${ViewID.debugBreakpointInput}"></input>
                    <button id="${ViewID.debugAddBreakpointButton}"></button>
                    <div id="${ViewID.debugErrorInfo}" class="displayNone">
                        <strong>Error:</strong> <span id="${ViewID.debugErrorText}"></span>
                    </div>
                    <input id="${ViewID.debugBreakOnErrorInput}" type="checkbox"></input>
                </fieldset>
            </div>
        `;

        rsCanvas = createCanvas(640, 400);
        rsCtx = rsCanvas.getContext('2d');

        const cpcCanvas = document.getElementById(ViewID.cpcCanvas) as HTMLCanvasElement;
        cpcCanvas.getContext = ((type: string) => {
            if (type === '2d') return rsCtx as any;
            return null;
        }) as any;

        window.AudioContext = vi.fn().mockImplementation(() => ({
            createGain: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0 } })),
            createChannelMerger: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
            createOscillator: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 } })),
            destination: {},
            close: vi.fn().mockImplementation(() => Promise.resolve()),
            state: 'running',
            resume: vi.fn(),
            currentTime: 0
        })) as any;
    });

    afterEach(() => {
        CpcLoco.fnDoStop();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        (CpcLoco as any).model = undefined;
        (CpcLoco as any).controller = undefined;
        (CpcLoco as any).view = undefined;
    });

    it('should start and stop CpcLoco 100 times with DOM recreation', async () => {
        const initialMemory = process.memoryUsage().heapUsed;
        console.log(`Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

        for (let i = 0; i < 100; i++) {
            document.body.innerHTML = `
                <div id="${ViewID.mainArea}">
                    <div id="${ViewID.cpcArea}" tabindex="0">
                    </div>
                    <div id="${ViewID.kbdArea}">
                        <div id="${ViewID.kbdAreaInner}">
                            <div id="${ViewID.kbdAlpha}"></div>
                            <div id="${ViewID.kbdNum}"></div>
                        </div>
                    </div>
                    <div id="${ViewID.outputArea}"></div>
                    <textarea id="${ViewID.outputText}"></textarea>
                    <div id="${ViewID.statusText}"></div>
                    <button id="${ViewID.runButton}"></button>
                    <button id="${ViewID.stopButton}"></button>
                    <button id="${ViewID.continueButton}"></button>
                    <button id="${ViewID.resetButton}"></button>
                    <button id="${ViewID.parseRunButton}"></button>
                    <div id="${ViewID.dropZone}"></div>
                    <input type="file" id="${ViewID.fileInput}"></input>
                    <select id="${ViewID.databaseSelect}"></select>
                    <select id="${ViewID.directorySelect}"></select>
                    <select id="${ViewID.exampleSelect}"></select>
                    <div id="${ViewID.resultText}"></div>
                    <textarea id="${ViewID.inputText}"></textarea>
                    <input id="${ViewID.renumNewInput}"></input>
                    <input id="${ViewID.renumStartInput}"></input>
                    <input id="${ViewID.renumStepInput}"></input>
                    <input id="${ViewID.renumKeepInput}"></input>
                    <textarea id="${ViewID.inp2Text}"></textarea>
                    <button id="${ViewID.undoButton}"></button>
                    <button id="${ViewID.undoButton2}"></button>
                    <button id="${ViewID.redoButton}"></button>
                    <button id="${ViewID.redoButton2}"></button>
                    <textarea id="${ViewID.disassText}"></textarea>
                    <!-- Debug elements -->
                    <fieldset id="${ViewID.debugArea}" class="displayNone">
                        <input id="${ViewID.debugSpeedInput}" type="range"></input>
                        <span id="${ViewID.debugLineLabel}"></span>
                        <button id="${ViewID.debugPauseButton}"></button>
                        <button id="${ViewID.debugResumeButton}"></button>
                        <button id="${ViewID.debugStepIntoButton}"></button>
                    <button id="${ViewID.debugStepOverButton}"></button>
                    <button id="${ViewID.debugStepOutButton}"></button>
                    <div id="${ViewID.debugCallStack}">
                        <ol id="${ViewID.debugCallStackList}"></ol>
                    </div>
                        <input id="${ViewID.debugModeInput}" type="checkbox"></input>
                        <div id="${ViewID.debugBreakpointList}"></div>
                        <input id="${ViewID.debugBreakpointInput}"></input>
                        <button id="${ViewID.debugAddBreakpointButton}"></button>
                        <div id="${ViewID.debugErrorInfo}" class="displayNone">
                            <strong>Error:</strong> <span id="${ViewID.debugErrorText}"></span>
                        </div>
                        <input id="${ViewID.debugBreakOnErrorInput}" type="checkbox"></input>
                    </fieldset>
                </div>
            `;

            // Manually create and append canvas to ensure it's patched
            const canvas = document.createElement('canvas');
            canvas.id = ViewID.cpcCanvas;
            canvas.width = 640;
            canvas.height = 400;
            document.getElementById(ViewID.cpcArea)?.appendChild(canvas);

            CpcLoco.fnDoStart();
            CpcLoco.fnDoStop();

            document.body.innerHTML = '';
            (CpcLoco as any).model = undefined;
            (CpcLoco as any).controller = undefined;
            (CpcLoco as any).view = undefined;

            if (i % 20 === 0) {
                const currentMemory = process.memoryUsage().heapUsed;
                console.log(`Iteration ${i}: Heap used ${(currentMemory / 1024 / 1024).toFixed(2)} MB`);
            }
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const diff = (finalMemory - initialMemory) / 1024 / 1024;
        console.log(`Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB (Diff: ${diff.toFixed(2)} MB)`);

        expect(diff).toBeLessThan(150);
    });
});
