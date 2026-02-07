import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Controller } from 'cpclocots';
import { ViewID } from 'cpclocots';

// Mocks
const mockView = {
    setAreaValue: () => { },
    setAreaScrollTop: () => { },
    setDisabled: () => { },
    setSelectValue: () => { },
    getAreaValue: () => "",
    getElementById1: () => ({}),
    setCanvasType: () => { },
    setHidden: () => { },
    getHidden: () => false,
    addEventListenerById: () => { },
    removeEventListenerById: () => { },
    setAreaVisible: () => { },
    setSelectOptions: () => { },
    setAreaSelectionRange: () => { },
    getInputChecked: () => false,
    getInputValue: () => "0",
    setAreaSelection: () => { },
    getSelectValue: () => ""
};

const mockModel = {
    getProperty: vi.fn((prop) => {
        if (prop === 'canvasType') return 'canvas';
        return false;
    }),
    setProperty: vi.fn()
};

const mockVm = {
    vmReset: vi.fn(),
    vmRegisterRsx: vi.fn(),
    vmGetStopObject: vi.fn(),
    vmGetOutBuffer: vi.fn(),
    vmStop: vi.fn(),
    vmGetTimeUntilFrame: vi.fn(),
    vmResetControlBuffer: vi.fn(),
    print: vi.fn(),
    cursor: vi.fn(),
    tagoff: vi.fn(),
    pos: vi.fn(),
    vmResetData: vi.fn(),
    vmReset4Run: vi.fn(),
    vmGoto: vi.fn(),
    vmSetStartLine: vi.fn(),
    vmGetOutFileObject: vi.fn(() => ({ open: false }))
};

vi.mock('../src/CpcVm', () => {
    return {
        CpcVm: vi.fn(() => mockVm)
    };
});

vi.mock('../src/Variables', () => ({
    Variables: vi.fn(() => ({
        getVariable: vi.fn(),
        setVariable: vi.fn()
    }))
}));

vi.mock('../src/Keyboard', () => ({
    Keyboard: vi.fn(() => ({}))
}));

vi.mock('../src/Sound', () => ({
    Sound: vi.fn(() => ({
        setActivatedByUser: vi.fn()
    }))
}));

describe('Controller Memory Test', () => {
    let controller: Controller;
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

        timeouts = [];
        vi.stubGlobal('setTimeout', (fn: Function, delay: number) => {
            timeouts.push(fn);
            return 123;
        });

        controller = new Controller(mockModel as any, mockView as any);
        (controller as any).vm = mockVm; // Inject mock VM
    });

    afterEach(() => {
        if (controller) {
            controller.stopMainLoop();
            controller.stopUpdateCanvas();
        }
        vi.restoreAllMocks();
    });

    it('should run 10,000 loops of fnRunLoop without crashing', async () => {
        // Setup VM to always return "no stop" so loop continues
        mockVm.vmGetStopObject.mockReturnValue({ reason: "" });

        // Mock fnRunPart1 to do nothing (simulating VM step)
        // Use a simple function instead of vi.fn() to avoid OOM from call history
        (controller as any).fnRunPart1 = () => { };
        (controller as any).fnScript = () => { }; // Fake script

        // Start loop
        (controller as any).fnRunLoop();

        // Drain queue
        let count = 0;
        const limit = 10000;

        console.log("Starting 10k loop test...");
        const start = performance.now();

        while (timeouts.length > 0 && count < limit) {
            const fn = timeouts.shift();
            if (fn) fn();
            count++;
        }

        const end = performance.now();
        console.log(`Finished ${count} loops in ${(end - start).toFixed(2)}ms`);

        expect(count).toBe(limit);
    });
});
