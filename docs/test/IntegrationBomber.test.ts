import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { ViewID, View, Keyboard, Utils } from 'cpclocots';
import { CpcLoco } from '../src/main';
import * as fs from 'fs';
import * as path from 'path';

describe('Integration: BOMBER.BAS', () => {
    let rsCanvas: any;
    let rsCtx: any;
    let originalLocalStorage: any;
    let storageData: Record<string, string> = {};
    let timeouts: Function[] = []; // Queue for manual execution

    beforeEach(() => {
        storageData = {};
        timeouts = []; // Reset queue

        originalLocalStorage = Utils.localStorage;
        Utils.localStorage = {
            getItem: vi.fn((key: string) => storageData[key] || null),
            setItem: vi.fn((key: string, value: string) => { storageData[key] = value; }),
            removeItem: vi.fn((key: string) => { delete storageData[key]; }),
            key: vi.fn((index: number) => Object.keys(storageData)[index] || null),
            length: 0
        } as any;

        document.body.innerHTML = `
            <div id="${ViewID.mainArea}">
                <div id="${ViewID.cpcArea}" tabindex="0">
                    <canvas id="${ViewID.cpcCanvas}" width="640" height="400"></canvas>
                </div>
                <!-- ... other elements ... -->
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
                <div id="${ViewID.runButton}"></div>
                <div id="${ViewID.parseRunButton}"></div>
                <div id="${ViewID.stopButton}"></div>
                <div id="${ViewID.continueButton}"></div>
                <div id="${ViewID.resetButton}"></div>
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
                <div id="${ViewID.undoButton}"></div>
                <div id="${ViewID.undoButton2}"></div>
                <div id="${ViewID.redoButton}"></div>
                <div id="${ViewID.redoButton2}"></div>
            </div>
        `;

        rsCanvas = createCanvas(640, 400);
        rsCtx = rsCanvas.getContext('2d');

        const cpcCanvas = document.getElementById(ViewID.cpcCanvas) as HTMLCanvasElement;
        const originalGetContext = cpcCanvas.getContext;
        cpcCanvas.getContext = ((type: string, options?: any) => {
            if (type === '2d') {
                return rsCtx as any;
            }
            return originalGetContext.call(cpcCanvas, type, options);
        }) as any;
        cpcCanvas.toDataURL = rsCanvas.toDataURL.bind(rsCanvas);

        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);
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

        CpcLoco.fnDoStart();

        // Mock setTimeout to queue execution instead of running async
        vi.stubGlobal('setTimeout', (fn: Function, delay: number) => {
            timeouts.push(fn);
            return 123; // Dummy ID
        });

        // Mock requestAnimationFrame to just queue as well
        vi.stubGlobal('requestAnimationFrame', (fn: Function) => {
            timeouts.push(fn);
            return 123;
        });

        // Patch VM logic
        const coreControllerValid = CpcLoco.controller.controller;
        const vm = coreControllerValid.getVm();

        // Dont stop on frame
        vi.spyOn(vm, 'frame').mockImplementation(() => { });

        // Force next frame to be "now" always
        vi.spyOn(vm, 'vmGetTimeUntilFrame').mockReturnValue(0);

        // Spy on vmStop to debug why it stops
        const originalVmStop = vm.vmStop.bind(vm);
        vi.spyOn(vm, 'vmStop').mockImplementation((reason, priority, force, paras) => {
            if (reason === 'fileLoad' || reason === 'run') {
                return; // Ignore fileLoad/run stops to keep loop running
            }
            // Timer stops are ALLOWED (they will just schedule a setTimeout/callback)
            originalVmStop(reason, priority, force, paras);
        });

        // Set internal VM cycle limit lower
        (vm as any).initialStop = 50;
        (vm as any).stopCount = 50;

        vi.spyOn(Utils.console, 'error').mockImplementation((...args) => {
            console.error("[Utils Error]", ...args);
        });
    });

    afterEach(() => {
        Utils.localStorage = originalLocalStorage;
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        (CpcLoco as any).model = undefined;
        (CpcLoco as any).controller = undefined;
        (CpcLoco as any).view = undefined;
    });

    // Helper to run the queued timeouts manually
    const queuedExecution = async (limit: number) => {
        let count = 0;
        console.log("Starting queued execution with limit:", limit);
        while (timeouts.length > 0 && count < limit) {
            const fn = timeouts.shift();
            if (fn) fn();
            count++;
            if (count % 10 === 0) console.log("Step:", count, "Queue:", timeouts.length);

            // Yield every 50 steps
            if (count % 50 === 0) {
                await new Promise(r => setImmediate ? setImmediate(r) : process.nextTick(r));
            }
        }
        console.log("Finished queued execution. Executed:", count);
        return count;
    };

    it('should run BOMBER.BAS and initialize correctly', async () => {
        const bomberBasPath = path.resolve(__dirname, '../../basic/BOMBER.BAS');
        const bomberBasic = fs.readFileSync(bomberBasPath, 'utf8');

        (CpcLoco as any).view.setAreaValue(ViewID.inputText, bomberBasic);

        const vm = CpcLoco.controller.controller.getVm();
        const modeSpy = vi.spyOn(vm, 'mode');

        // Start execution
        console.log("Calling startParseRun...");
        CpcLoco.controller.controller.startParseRun();
        console.log("startParseRun returned. Timeouts queue length:", timeouts.length);

        // Manually run the loop for N steps
        await queuedExecution(500);

        expect(modeSpy).toHaveBeenCalledWith(1);

        const variables = (CpcLoco.controller.controller as any).variables;
        const score = variables.getVariable('score');
        const x = variables.getVariable('x');
        const y = variables.getVariable('y');

        expect(score).toBe(0);
        expect(x).toBe(2);
        expect(y).toBe(2);

        // Additional input test if we survive this far
        const coreController = CpcLoco.controller.controller;
        const keyboard = (coreController as any).keyboard as Keyboard;
        keyboard.putKeyInBuffer(" ");
        // await queuedExecution(100); 
    }, 10000);
});
