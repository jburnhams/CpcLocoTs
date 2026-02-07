import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Controller } from 'cpclocots';
import { ViewID } from 'cpclocots';

// Mocks
const mockView = {
    setAreaValue: vi.fn(),
    setAreaScrollTop: vi.fn(),
    setDisabled: vi.fn(),
    setSelectValue: vi.fn(),
    getAreaValue: vi.fn(),
    getElementById1: vi.fn(),
    setCanvasType: vi.fn()
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
        timeouts = [];
        vi.stubGlobal('setTimeout', (fn: Function, delay: number) => {
            timeouts.push(fn);
            return 123;
        });

        controller = new Controller(mockModel as any, mockView as any);
        (controller as any).vm = mockVm; // Inject mock VM
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should run 1,000,000 loops of fnRunLoop without crashing', async () => {
        // Setup VM to always return "no stop" so loop continues
        mockVm.vmGetStopObject.mockReturnValue({ reason: "" });

        // Mock fnRunPart1 to do nothing (simulating VM step)
        (controller as any).fnRunPart1 = vi.fn();
        (controller as any).fnScript = () => { }; // Fake script

        // Start loop
        (controller as any).fnRunLoop();

        // Drain queue
        let count = 0;
        const limit = 1000000;

        console.log("Starting 1M loop test...");
        const start = performance.now();

        while (timeouts.length > 0 && count < limit) {
            const fn = timeouts.shift();
            if (fn) fn();
            count++;
            if (count % 100000 === 0) {
                // Force GC if we could (not available in standard JS, but V8 has triggers)
                // This test relies on process crashing if OOM
                // await new Promise(r => setImmediate(r)); // Yield to let checking happen
            }
        }

        const end = performance.now();
        console.log(`Finished ${count} loops in ${(end - start).toFixed(2)}ms`);

        expect(count).toBe(limit);
    });
});
