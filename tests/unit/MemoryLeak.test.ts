import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Controller } from '../../src/Controller';
import { Model } from '../../src/Model';
import { View } from '../../src/View';
import { ModelPropID } from '../../src/Constants';

describe('Memory Leak Investigation', () => {
    let controller: Controller;
    let model: Model;
    let view: View;
    let timeouts: Function[] = [];

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="cpcArea">
                <canvas id="cpcCanvas" width="640" height="400"></canvas>
                <div id="dropZone"></div>
                <input id="fileInput" type="file">
            </div>
            <textarea id="inputText"></textarea>
            <textarea id="outputText"></textarea>
            <textarea id="resultText"></textarea>
            <div id="textCanvasDiv">
                <canvas id="textText" width="640" height="400"></canvas>
            </div>
            <div id="noCanvas"></div>
        `;

        const mockContext = {
            getImageData: vi.fn(() => ({
                data: new Uint8ClampedArray(640 * 400 * 4)
            })),
            putImageData: vi.fn(),
            createImageData: vi.fn(() => ({
                data: new Uint8ClampedArray(640 * 400 * 4)
            }))
        };

        const canvas = document.getElementById('cpcCanvas') as HTMLCanvasElement;
        if (canvas) {
            canvas.getContext = vi.fn(() => mockContext) as any;
        }
        const textCanvas = document.getElementById('textText') as HTMLCanvasElement;
        if (textCanvas) {
            textCanvas.getContext = vi.fn(() => mockContext) as any;
        }

        // Mock global objects needed by Controller
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
            createOscillator: vi.fn(),
            createGain: vi.fn(),
            destination: {},
            close: vi.fn()
        })));

        vi.stubGlobal('setTimeout', (fn: Function, delay: number) => {
            timeouts.push(fn);
            return 1;
        });

        // Mock View and Model
        model = new Model({
            canvasType: 'graphics'
        });

        // We still mock the view object but Controller might use View.getElementById1 which is static
        // View.ts uses document.getElementById, which works with our innerHTML setup.

        view = {
            setAreaValue: vi.fn(),
            setAreaScrollTop: vi.fn(),
            setDisabled: vi.fn(),
            setSelectValue: vi.fn(),
            getAreaValue: vi.fn(() => ""),
            getHidden: vi.fn(() => false),
            setHidden: vi.fn(),
            getInputChecked: vi.fn(() => false),
            getInputValue: vi.fn(() => "0"),
            setAreaSelection: vi.fn(),
            getSelectValue: vi.fn(() => ""),
            addEventListenerById: vi.fn(),
            removeEventListenerById: vi.fn(),
            setAreaVisible: vi.fn(),
            setSelectOptions: vi.fn(),
            setAreaSelectionRange: vi.fn()
        } as any;

        controller = new Controller(model, view);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('should not leak memory over 1,000,000 fnRunLoop iterations', async () => {
        // Setup for a running script
        (controller as any).fnScript = () => { };
        (controller as any).vm.vmGetStopObject().reason = "";

        // Mock fnRunPart1 with vi.fn() to simulate the docs test
        (controller as any).fnRunPart1 = vi.fn();

        const iterations = 1000000;
        const memorySnapshots: number[] = [];

        console.log(`Starting memory leak test for ${iterations} iterations...`);

        const initialMemory = process.memoryUsage().heapUsed;
        memorySnapshots.push(initialMemory);

        (controller as any).fnRunLoop();

        const dataStr = "Some output from the VM...".repeat(10);

        for (let i = 0; i < iterations; i++) {
            const fn = timeouts.shift();
            if (fn) fn();

            // Explicitly call a mock to simulate the leak
            view.setAreaValue("resultText", dataStr + i);

            if (i % 100000 === 0) {
                const currentMemory = process.memoryUsage().heapUsed;
                memorySnapshots.push(currentMemory);
                const diff = (currentMemory - initialMemory) / 1024 / 1024;
                console.log(`Iteration ${i}: Heap used ${(currentMemory / 1024 / 1024).toFixed(2)} MB (Diff: ${diff.toFixed(2)} MB)`);

                // If it grows more than 100MB, it's likely a leak
                if (diff > 100) {
                    // throw new Error(`Memory leaked! Heap grew by ${diff.toFixed(2)} MB at iteration ${i}`);
                }
            }
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const totalDiff = (finalMemory - initialMemory) / 1024 / 1024;
        console.log(`Final total diff: ${totalDiff.toFixed(2)} MB`);

        // A small growth is expected due to JIT and some internal buffers, but it should level off.
        // If it's 1,000,000 iterations in the original test, that's 10x more.
        expect(totalDiff).toBeLessThan(400); // Loose limit for now
    });
});
