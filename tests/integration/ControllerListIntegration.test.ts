
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Controller } from '../../src/Controller';
import { Model } from '../../src/Model';
import { View } from '../../src/View';
import { ModelPropID, ViewID } from '../../src/Constants';

describe('Controller List Integration Tests', () => {
    let jsdom: JSDOM;

    beforeEach(() => {
        // Setup JSDOM
        jsdom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <textarea id="${ViewID.inputText}"></textarea>
                <textarea id="${ViewID.outputText}"></textarea>
                <textarea id="${ViewID.resultText}"></textarea>
                <textarea id="${ViewID.consoleLogArea}"></textarea>
                <div id="${ViewID.cpcArea}">
                    <canvas id="${ViewID.cpcCanvas}"></canvas>
                </div>
                <div id="${ViewID.textText}"></div>
                <div id="${ViewID.noCanvas}"></div>
                <input id="${ViewID.fileInput}" type="file">
                <div id="${ViewID.dropZone}"></div>
                <select id="${ViewID.exampleSelect}"></select>
                <select id="${ViewID.varSelect}"></select>
                <input id="${ViewID.varText}">
                <button id="${ViewID.runButton}"></button>
                <button id="${ViewID.stopButton}"></button>
                <button id="${ViewID.continueButton}"></button>
                <button id="${ViewID.undoButton}"></button>
                <button id="${ViewID.undoButton2}"></button>
                <button id="${ViewID.redoButton}"></button>
                <button id="${ViewID.redoButton2}"></button>
                <textarea id="${ViewID.disassText}"></textarea>
                <div id="${ViewID.disassArea}"></div>
                <div id="${ViewID.inp2Area}"></div>
                <textarea id="${ViewID.inp2Text}"></textarea>
                <div id="${ViewID.inputArea}"></div>
                <div id="${ViewID.kbdArea}"></div>
                <div id="${ViewID.mainArea}"></div>
                <div id="${ViewID.outputArea}"></div>
                <div id="${ViewID.resultArea}"></div>
                <div id="${ViewID.variableArea}"></div>
                <input id="${ViewID.prettySpaceInput}" type="checkbox">
                <input id="${ViewID.prettyBracketsInput}" type="checkbox">
                <input id="${ViewID.prettyColonsInput}" type="checkbox">
                <input id="${ViewID.renumNewInput}" value="10">
                <input id="${ViewID.renumStartInput}" value="10">
                <input id="${ViewID.renumStepInput}" value="10">
                <input id="${ViewID.renumKeepInput}" value="65535">
            </body>
            </html>
        `, {
            url: "http://localhost/",
            pretendToBeVisual: true,
            resources: "usable"
        });

        global.window = jsdom.window as any;
        global.document = jsdom.window.document;
        global.HTMLElement = jsdom.window.HTMLElement;
        global.HTMLCanvasElement = jsdom.window.HTMLCanvasElement;
        global.HTMLTextAreaElement = jsdom.window.HTMLTextAreaElement;
        global.HTMLInputElement = jsdom.window.HTMLInputElement;
        global.HTMLSelectElement = jsdom.window.HTMLSelectElement;
        global.HTMLButtonElement = jsdom.window.HTMLButtonElement;

        // Mock AudioContext
        global.window.AudioContext = vi.fn().mockImplementation(() => ({
             createGain: vi.fn(() => ({ connect: vi.fn(), gain: { value: 0 } })),
             createOscillator: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
             destination: {},
             currentTime: 0,
             state: 'suspended',
             resume: vi.fn().mockResolvedValue(undefined),
             suspend: vi.fn().mockResolvedValue(undefined),
             onstatechange: null
        })) as any;

        // Mock requestAnimationFrame
        global.requestAnimationFrame = (callback: FrameRequestCallback) => {
            return setTimeout(callback, 16) as unknown as number;
        };
        global.cancelAnimationFrame = (id: number) => {
            clearTimeout(id);
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        // @ts-ignore
        delete global.window;
        // @ts-ignore
        delete global.document;
    });

    test('Integration: LIST command escapes control characters', () => {
        const model = new Model({
            [ModelPropID.canvasType]: 'none', // Use NoCanvas to simplify
            [ModelPropID.basicVersion]: 'BP 1.0'
        });
        const view = new View();
        const controller = new Controller(model, view);

        const inputScript = '10 PRINT "Hidden\x00Char"';
        view.setAreaValue(ViewID.inputText, inputScript);

        const vm = controller.getVm();
        // Spy on vm.print to verify output
        const printSpy = vi.spyOn(vm, 'print');
        printSpy.mockImplementation(() => {});

        // We access private fnList via any for testing or trigger it via vm command?
        // Triggering via vm command is better integration.
        // vm.vmStop sends a 'list' reason.

        // However, fnList is a private method called by fnRunLoop when stop.reason is 'list'.
        // We can manually trigger the handler map if we can access it, or use runLoop.

        // Easier way: Controller has methods mapped to VM stop reasons.
        // But fnList is private.
        // Let's use the public way: The VM stops with "list", then the controller picks it up in runLoop.

        // But we want to test specifically the escaping logic.
        // Using (controller as any).fnList is a pragmatic bridge for this integration test.

        (controller as any).fnList({
            stream: 0,
            first: 0,
            last: 65535
        });

        // "Hidden\x00Char" -> "Hidden\x01\x00Char"
        const expected = '10 PRINT "Hidden\x01\x00Char"';
        expect(printSpy).toHaveBeenCalledWith(0, expected, "\r\n");
    });
});
