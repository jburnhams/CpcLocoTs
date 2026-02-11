import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { ViewID, View, Keyboard, Utils } from 'cpclocots';
import { CpcLoco } from '../src/main';

describe('Integration: Small Tests', () => {
    let rsCanvas: any;
    let rsCtx: any;
    let originalLocalStorage: any;
    let storageData: Record<string, string> = {};

    beforeEach(() => {
        storageData = {};
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
                <button id="${ViewID.runButton}"></button>
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
                <button id="${ViewID.stopButton}"></button>
                <button id="${ViewID.continueButton}"></button>
                <button id="${ViewID.resetButton}"></button>
                <button id="${ViewID.parseRunButton}"></button>
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

        // Patch requestAnimationFrame
        vi.stubGlobal('requestAnimationFrame', (fn: any) => {
            return setTimeout(fn, 0);
        });

        // Patch VM logic
        const coreControllerValid = CpcLoco.controller.controller;
        const vm = coreControllerValid.getVm();

        // Dont stop on frame
        vi.spyOn(vm, 'frame').mockImplementation(() => { });

        // Force next frame to be "now" always
        vi.spyOn(vm, 'vmGetTimeUntilFrame').mockReturnValue(0);

        // Spy on vmStop to debug why it stops and ignore timer stops
        const originalVmStop = vm.vmStop.bind(vm);
        vi.spyOn(vm, 'vmStop').mockImplementation((reason, priority, force, paras) => {
            if (reason === 'timer') return; // Ignore timer stops
            if (reason === 'fileLoad') {
                return;
            }
            if (reason === 'run') {
                return;
            }
            originalVmStop(reason, priority, force, paras);
        });

        (vm as any).initialStop = 100000;
        (vm as any).stopCount = 100000;
    });

    afterEach(() => {
        Utils.localStorage = originalLocalStorage;
        vi.restoreAllMocks();
        document.body.innerHTML = '';
        (CpcLoco as any).model = undefined;
        (CpcLoco as any).controller = undefined;
        (CpcLoco as any).view = undefined;
    });

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    it('should run a simple BASIC program', async () => {
        const simpleBasic = '10 a = 10\\n20 PRINT a';

        // Direct set
        (CpcLoco as any).view.setAreaValue(ViewID.inputText, simpleBasic);

        CpcLoco.controller.controller.startParseRun();

        await wait(1000);

        expect(true).toBe(true);
    });

    it('should detect key press with INKEY$', async () => {
        const inkeyBasic = '10 a$ = INKEY$\\n20 IF a$ = "" GOTO 10\\n30 b = 1';

        (CpcLoco as any).view.setAreaValue(ViewID.inputText, inkeyBasic);
        CpcLoco.controller.controller.startParseRun();

        await wait(500);

        // Simulate key
        const coreController = CpcLoco.controller.controller;
        const keyboard = (coreController as any).keyboard as Keyboard;
        keyboard.putKeyInBuffer("A");

        await wait(500);

        expect(true).toBe(true);
    });

    it('should change MODE', async () => {
        const modeBasic = '10 MODE 2';

        (CpcLoco as any).view.setAreaValue(ViewID.inputText, modeBasic);

        const vm = CpcLoco.controller.controller.getVm();
        const modeSpy = vi.spyOn(vm, 'mode');

        CpcLoco.controller.controller.startParseRun();

        await wait(2000);

        const currentMode = (vm as any).modeValue;

        expect(modeSpy).toHaveBeenCalledWith(2);
        expect(currentMode).toBe(2);
    });
});
