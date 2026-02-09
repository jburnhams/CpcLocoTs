import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ViewID, Keyboard, Utils } from 'cpclocots';
import { CpcLoco } from '../src/main';
import * as fs from 'fs';
import * as path from 'path';

describe('Integration: BOMBER.BAS', () => {
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
                </fieldset>
            </div>
        `;

        const canvas = document.createElement('canvas');
        canvas.id = ViewID.cpcCanvas;
        canvas.width = 640;
        canvas.height = 400;
        document.getElementById(ViewID.cpcArea)?.appendChild(canvas);

        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);
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

    afterEach(async () => {
        CpcLoco.fnDoStop();
        Utils.localStorage = originalLocalStorage;
        vi.restoreAllMocks();
        vi.useRealTimers();
        document.body.innerHTML = '';
        (CpcLoco as any).model = undefined;
        (CpcLoco as any).controller = undefined;
        (CpcLoco as any).view = undefined;
        await new Promise(r => process.nextTick(r));
    });

    const stepExecution = async (limit: number) => {
        let count = 0;
        while (count < limit) {
            vi.runOnlyPendingTimers();
            count++;
            if (count % 10 === 0) {
                await new Promise(r => process.nextTick(r));
            }
        }
    };

    it('should initialize and load BOMBER.BAS correctly (smoke test)', async () => {
        if (global.gc) global.gc();
        const memBefore = process.memoryUsage();
        console.log(`DEBUG: Memory before Bomber: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);

        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        CpcLoco.fnDoStart();

        const coreController = CpcLoco.controller.controller;
        const vm = coreController.getVm();
        vi.spyOn(vm, 'frame').mockImplementation(() => { });
        vi.spyOn(vm, 'vmGetTimeUntilFrame').mockReturnValue(0);

        const bomberBasPath = path.resolve(__dirname, '../../basic/BOMBER.BAS');
        const bomberBasic = fs.readFileSync(bomberBasPath, 'utf8');

        (CpcLoco as any).view.setAreaValue(ViewID.inputText, bomberBasic);

        console.log("Calling startParseRun (Smoke Test)...");
        coreController.startParseRun();

        await stepExecution(10);

        console.log("Smoke test execution finished.");
        expect(CpcLoco.controller).toBeDefined();
    }, 15000);
});
